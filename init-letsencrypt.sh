#!/usr/bin/env bash
#
# Let's Encrypt 証明書のブートストラップ（初回取得）。
# 取得後の更新は certbot コンテナ（docker-compose.prod.yml）が自動で行う。
#
#   ./init-letsencrypt.sh              # = --staging（既定。レート制限の無いテスト用証明書）
#   ./init-letsencrypt.sh --staging
#   ./init-letsencrypt.sh --production # 本番証明書。staging で疎通確認後に実行する
#
# 必要な設定（.env.prod）:
#   MY_DOMAIN      … 対象ドメイン（例 d-party.net）。'localhost' のままだと中止する
#   CERTBOT_EMAIL  … 失効通知の送付先メールアドレス
#
set -euo pipefail
cd "$(dirname "$0")"

# --- .env.prod から設定を読む ---
# .env.prod は `KEY = value`（= の前後に空白あり）形式。Docker Compose は
# 空白をトリムして読むが POSIX の `.`/source は読めないため、ここで明示的に抜き出す。
read_env() {
  sed -n -E "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*(.*[^[:space:]])[[:space:]]*\$/\1/p" \
    ./.env.prod | head -n 1
}

DOMAIN="$(read_env MY_DOMAIN)"
EMAIL="$(read_env CERTBOT_EMAIL)"
[ -n "$DOMAIN" ] || { echo "MY_DOMAIN を .env.prod に設定してください" >&2; exit 1; }
[ -n "$EMAIL" ]  || { echo "CERTBOT_EMAIL を .env.prod に設定してください" >&2; exit 1; }

if [ "$DOMAIN" = "localhost" ]; then
  echo "MY_DOMAIN が 'localhost' のままです。本番ドメインに変更してください。" >&2
  exit 1
fi

# 主ドメインを先頭に（certbot は live/<先頭ドメイン> にディレクトリを作る）。
DOMAIN_ARGS="-d ${DOMAIN} -d www.${DOMAIN}"

STAGING=1
case "${1:-}" in
  --production) STAGING=0 ;;
  --staging | "") STAGING=1 ;;
  *) echo "不明な引数: $1 （--staging | --production）" >&2; exit 1 ;;
esac

DATA_PATH="./certbot"
RSA_KEY_SIZE=4096
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile letsencrypt"

# 推奨 TLS パラメータ（nginx の include 先）を取得する。
if [ ! -e "$DATA_PATH/conf/options-ssl-nginx.conf" ] || [ ! -e "$DATA_PATH/conf/ssl-dhparams.pem" ]; then
  echo "### 推奨 TLS パラメータを取得中 ..."
  mkdir -p "$DATA_PATH/conf"
  curl -fsSL https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/src/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
    > "$DATA_PATH/conf/options-ssl-nginx.conf"
  curl -fsSL https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
    > "$DATA_PATH/conf/ssl-dhparams.pem"
fi

# nginx は ssl_certificate が存在しないと起動できない。先にダミー証明書を置く。
echo "### ダミー証明書を作成中（$DOMAIN） ..."
LIVE_PATH="/etc/letsencrypt/live/$DOMAIN"
mkdir -p "$DATA_PATH/conf/live/$DOMAIN" "$DATA_PATH/www"
$COMPOSE run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 \
    -keyout '$LIVE_PATH/privkey.pem' \
    -out '$LIVE_PATH/fullchain.pem' \
    -subj '/CN=localhost'" certbot

echo "### nginx を起動中 ..."
$COMPOSE up --force-recreate -d nginx

echo "### ダミー証明書を削除中（$DOMAIN） ..."
$COMPOSE run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$DOMAIN && \
  rm -Rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -Rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

echo "### Let's Encrypt 証明書を要求中（$DOMAIN） ..."
STAGING_ARG=""
if [ "$STAGING" != "0" ]; then
  STAGING_ARG="--staging"
  echo "    （staging モード: テスト用証明書。ブラウザでは信頼されません）"
else
  echo "    （production モード: 本番証明書）"
fi

# shellcheck disable=SC2086
$COMPOSE run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    --email $EMAIL \
    $DOMAIN_ARGS \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos \
    --no-eff-email \
    --force-renewal" certbot

echo "### nginx をリロード中 ..."
$COMPOSE exec nginx nginx -c /etc/nginx/nginx.prod.conf -s reload

MODE=$([ "$STAGING" = 0 ] && echo production || echo staging)
echo "### 完了（${MODE} 証明書を発行しました）。"
echo "    本番起動: $COMPOSE up -d"
