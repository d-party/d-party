#!/usr/bin/env bash
# 保守用のローカルゲート。CI（.github/workflows/*-ci.yml · *-build.yml）と同じ検査を
# いまの作業ツリーに対して回し、結果を表で出す。
#
#   gates.sh                  すべての区分
#   gates.sh backend web      指定した区分だけ
#
# 区分:
#   backend   uv sync · ruff · mypy · makemigrations --check · pytest · license
#   web       pnpm install --frozen-lockfile · api:generate の drift · typecheck · lint ·
#             build · build-storybook · license（extension + frontend + packages/ui）
#   bundle    拡張機能の本番バンドル（build:prod と manifest の参照先）
#   smoke     frontend を起動して実際にページを叩く（web と同じ実行で回す。ビルドが無ければ FAIL）
#   compose   docker compose config（dev · prod · loadtest）
#   nginx     docker-compose.yml の nginx イメージでテンプレートを nginx -t にかける
#   infra     helm lint · helm template
#   repo      actionlint · shellcheck · yamllint
#   docker    backend / frontend のイメージをビルドする（数分かかる）
#
# 1 つ落ちても残りは回す（何が落ちるかを 1 回で知るため）。失敗があれば終了コード 1。
# SKIP は「通った」ではない。道具が無くて回せなかった検査なので、CI の結果で補う。
# ログは GATES_LOG_DIR（未指定なら一時ディレクトリ）に検査ごとに残る。落ちた検査は末尾
# GATES_TAIL 行（既定 25）を最後に出す。bundle は配布物の sha256 を bundle.sha256 に残す。
#
# shellcheck disable=SC2329
# 検査の本体は関数にして step へ引数で渡している。shellcheck からは未使用に見える。
set -uo pipefail

ROOT=$(git rev-parse --show-toplevel) || exit 2
cd "$ROOT" || exit 2

LOG_DIR=${GATES_LOG_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/gates.XXXXXX")}
mkdir -p "$LOG_DIR"
LOG_DIR=$(cd "$LOG_DIR" && pwd) || exit 2 # 検査は cd した先で走るので、絶対パスにする

ALL_SECTIONS=(backend web bundle smoke compose nginx infra repo docker)
NAMES=()
STATUSES=()
SECONDS_TAKEN=()
NOTES=()

record() {
  NAMES+=("$1")
  STATUSES+=("$2")
  SECONDS_TAKEN+=("$3")
  NOTES+=("${4:-}")
}

# step <名前> <ルートからの作業ディレクトリ> <コマンド...>
step() {
  local name=$1 dir=$2
  shift 2
  local log start=$SECONDS
  log=$(printf '%s/%02d-%s.log' "$LOG_DIR" "${#NAMES[@]}" "$(printf '%s' "$name" | tr -cs 'A-Za-z0-9.-' '_')")
  printf '▶ %s\n' "$name"
  if (cd "$ROOT/$dir" && "$@") >"$log" 2>&1; then
    record "$name" PASS $((SECONDS - start))
  else
    record "$name" FAIL $((SECONDS - start)) "$log"
    printf '  ✗ FAIL（%s）\n' "$log"
  fi
}

skip() {
  record "$1" SKIP 0 "$2"
  printf '▷ %s: SKIP（%s）\n' "$1" "$2"
}

have() { command -v "$1" >/dev/null 2>&1; }

port_open() { (exec 3<>"/dev/tcp/$1/$2") 2>/dev/null; }

# ── backend ──────────────────────────────────────────────────────────────────
backend_license() {
  local allow
  allow=$(grep -v '^[[:space:]]*#' license-whitelist-python.txt | grep -v '^[[:space:]]*$' | paste -sd ';')
  uv run pip-licenses --with-system --partial-match --allow-only="$allow"
}

gate_backend() {
  # CI（Backend/CI）と同じダミー env。呼び出し側で設定済みならそれを使う。
  export SECRET_KEY="${SECRET_KEY:-django-insecure-local-test}"
  export DEBUG="${DEBUG:-1}"
  export MY_DOMAIN="${MY_DOMAIN:-localhost}"
  export D_ANIME_STORE_DOMAIN="${D_ANIME_STORE_DOMAIN:-animestore.docomo.ne.jp}"
  export TIME_ZONE="${TIME_ZONE:-Asia/Tokyo}"
  export LANGUAGE_CODE="${LANGUAGE_CODE:-ja}"
  export DATABASE_ENGINE="${DATABASE_ENGINE:-django.db.backends.postgresql}"
  export DATABASE_USER="${DATABASE_USER:-d_party}"
  export DATABASE_HOST="${DATABASE_HOST:-localhost}"
  export DATABASE_PORT="${DATABASE_PORT:-5432}"
  export POSTGRES_DB="${POSTGRES_DB:-d_party}"
  export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-password}"
  export REDIS_HOST="${REDIS_HOST:-localhost}"
  export REDIS_PORT="${REDIS_PORT:-6379}"
  export CHROME_EXTENSION_REQUIRED_VERSION="${CHROME_EXTENSION_REQUIRED_VERSION:-1.0.0}"

  # GitHub Actions ではジョブの services が postgres を立てている。
  if ! port_open "$DATABASE_HOST" "$DATABASE_PORT"; then
    step "backend: start postgres" . docker compose up -d --wait postgres
  fi

  step "backend: uv sync --frozen" backend uv sync --frozen
  step "backend: ruff format --check" backend uv run ruff format --check .
  step "backend: ruff check" backend uv run ruff check .
  step "backend: mypy" backend uv run mypy .
  step "backend: makemigrations --check" backend uv run python manage.py makemigrations --check --dry-run
  # --create-db: 古いテスト DB が残っていると偽の失敗が出る。
  step "backend: pytest" backend uv run pytest -q --create-db --cov
  step "backend: license" backend backend_license
}

# ── extension + frontend + packages/ui ───────────────────────────────────────
gate_web() {
  step "web: pnpm install --frozen-lockfile" . pnpm install --frozen-lockfile
  # 判定に使う実行は turbo のキャッシュを使わない。
  step "web: api:generate" . pnpm exec turbo run api:generate --force
  step "web: api:generate drift" . git diff --exit-code -- \
    extension/src/infrastructure/api/generated frontend/src/infrastructure/api/generated
  step "web: typecheck" . pnpm exec turbo run typecheck --force
  step "web: lint" . pnpm exec turbo run lint --force
  step "web: build" . pnpm exec turbo run build --force
  step "web: build-storybook" . pnpm exec turbo run build-storybook --force
  step "web: license" . pnpm exec turbo run license:check
}

# ── 拡張機能の本番バンドル ───────────────────────────────────────────────────
# Extension/Build と同じ確認。rspack は黙って空の出力を出すことがある。
bundle_verify() {
  test -f manifest.json || {
    echo "manifest.json がない"
    return 1
  }
  node -e '
    const fs = require("fs");
    const m = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
    const files = new Set();
    files.add(m.background.service_worker);
    for (const cs of m.content_scripts ?? []) {
      for (const f of [...(cs.js ?? []), ...(cs.css ?? [])]) files.add(f);
    }
    if (m.action?.default_popup) files.add(m.action.default_popup);
    let bad = 0;
    for (const f of files) {
      const ok = fs.existsSync(f) && fs.statSync(f).size > 0;
      console.log("  " + (ok ? "ok  " : "MISS") + " " + f);
      if (!ok) bad++;
    }
    if (bad) { console.error(bad + " 個の参照先が空か存在しない"); process.exit(1); }
    if (/localhost/.test(JSON.stringify(m))) {
      console.error("manifest に localhost が残っている"); process.exit(1);
    }
    console.log("manifest version: " + m.version);
  ' || return 1
  du -sh . | sed 's/^/bundle size: /'
  # 配布物の指紋。control と比べれば、更新が拡張機能の中身を変えたかどうかが分かる。
  find . -type f -print0 | sort -z | xargs -0 sha256sum >"$LOG_DIR/bundle.sha256" || return 1
  echo "bundle files: $(wc -l <"$LOG_DIR/bundle.sha256")（$LOG_DIR/bundle.sha256）"
}

gate_bundle() {
  step "bundle: extension build:prod" . pnpm --filter d-party-chrome-extension run build:prod
  step "bundle: manifest references" extension/dist bundle_verify
}

# ── frontend の起動確認 ──────────────────────────────────────────────────────
# ビルドが通っても実行時に落ちる更新（SSR · OG 画像 · ルーティング）を拾う。
expect_status() {
  local path=$1 want=$2 got
  got=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${SMOKE_PORT}${path}")
  printf '%-40s %s（期待 %s）\n' "$path" "$got" "$want"
  [ "$got" = "$want" ]
}

smoke_frontend() {
  local pid rc=0 i ctype
  # Frontend/Build の「standalone 出力の確認」と同じ。無ければ落とす（SKIP にしない）。
  if [ ! -f .next/standalone/frontend/server.js ] || [ ! -d .next/static ]; then
    echo "frontend の standalone ビルドが無い。web と同じ実行で回す（gates.sh web smoke）"
    return 1
  fi
  # 先客がいると、古いビルドを叩いて通ってしまう。
  if port_open 127.0.0.1 "$SMOKE_PORT"; then
    echo "${SMOKE_PORT} 番が使われている。残っているサーバを止めるか SMOKE_PORT を変える"
    return 1
  fi
  # standalone 出力なので next start ではなく server.js を起動する（本番イメージと同じ）。
  # 繰り返し回しても入れ子にならないよう、中身を写す。
  mkdir -p .next/standalone/frontend/.next/static .next/standalone/frontend/public
  cp -r .next/static/. .next/standalone/frontend/.next/static/ || return 1
  if [ -d public ]; then cp -r public/. .next/standalone/frontend/public/ || return 1; fi
  PORT=$SMOKE_PORT HOSTNAME=127.0.0.1 setsid node .next/standalone/frontend/server.js &
  pid=$!
  # 途中で止められてもサーバを残さない（step がサブシェルで呼ぶので、trap はここで閉じる）。
  trap 'kill -- "-$pid" 2>/dev/null' EXIT
  trap 'exit 1' INT TERM
  for i in $(seq 1 60); do
    port_open 127.0.0.1 "$SMOKE_PORT" && break
    sleep 1
  done
  if ! kill -0 "$pid" 2>/dev/null || ! port_open 127.0.0.1 "$SMOKE_PORT"; then
    echo "server.js が ${SMOKE_PORT} 番で起動しなかった"
    return 1
  fi

  for path in / /usage /qa /privacy /stats /anime-store/lobby/test-room-123; do
    expect_status "$path" 200 || rc=1
  done
  expect_status /nope 404 || rc=1

  # 拡張機能との DOM 契約。壊れるとロビーからルームへ遷移できなくなる。
  # 末尾に / を付けると 308 が返り、本文が空になる。
  if curl -s "http://127.0.0.1:${SMOKE_PORT}/anime-store/lobby/test-room-123" | grep -q chrome_extension_field; then
    echo "chrome_extension_field: あり"
  else
    echo "chrome_extension_field: なし"
    rc=1
  fi

  # OG 画像（Satori + 日本語フォント）が実際に PNG を返すか。
  ctype=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' \
    "http://127.0.0.1:${SMOKE_PORT}/anime-store/lobby/test/opengraph-image")
  echo "opengraph-image: $ctype"
  [ "$ctype" = "200 image/png" ] || rc=1

  kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
  return "$rc"
}

gate_smoke() {
  export SMOKE_PORT="${SMOKE_PORT:-3111}"
  step "smoke: frontend" frontend smoke_frontend
}

# ── docker compose ───────────────────────────────────────────────────────────
gate_compose() {
  step "compose: dev" . docker compose config -q
  step "compose: prod" . docker compose -f docker-compose.yml -f docker-compose.prod.yml config -q
  step "compose: loadtest" . docker compose -f docker-compose.yml -f docker-compose.override.yml \
    -f docker-compose.loadtest.yml --profile loadtest config -q
}

# ── nginx ────────────────────────────────────────────────────────────────────
# Nginx/CI はイメージを固定で持つので、compose の nginx を上げる PR は CI では検査されない。
# ここでは compose が実際に使うイメージでテンプレートを検査する。
nginx_test() {
  local template=$1 image certs=$LOG_DIR/nginx-certs
  image=$(docker compose config --format json | jq -r '.services.nginx.image')
  echo "image: $image"
  if [ ! -f "$certs/ssl-dhparams.pem" ]; then
    mkdir -p "$certs/live/localhost"
    openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=localhost" \
      -keyout "$certs/live/localhost/privkey.pem" -out "$certs/live/localhost/fullchain.pem"
    openssl dhparam -dsaparam -out "$certs/ssl-dhparams.pem" 2048
    : >"$certs/options-ssl-nginx.conf"
  fi
  # shellcheck disable=SC2016
  # コンテナ内の sh に渡す。$MY_DOMAIN などはここで展開しない。
  docker run --rm \
    -e MY_DOMAIN=localhost -e DJANGO_UPSTREAM=127.0.0.1:8000 -e FRONTEND_UPSTREAM=127.0.0.1:3000 \
    -v "$ROOT/$template:/etc/nginx/templates/default.conf.template:ro" \
    -v "$ROOT/nginx/mime.types:/etc/nginx/mime.types:ro" \
    -v "$certs:/etc/letsencrypt:ro" \
    --entrypoint sh "$image" -c '
      envsubst "\$MY_DOMAIN \$DJANGO_UPSTREAM \$FRONTEND_UPSTREAM" \
        < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
      nginx -t'
}

gate_nginx() {
  step "nginx: dev template" . nginx_test nginx/templates/http.conf.template
  step "nginx: prod template" . nginx_test nginx/templates-prod/default.conf.template
}

# ── infra ────────────────────────────────────────────────────────────────────
helm_template_prod() {
  helm template d-party infra/helm/d-party \
    --set config.MY_DOMAIN=d-party.example \
    --set secret.existingSecret=d-party-secret >/dev/null
}

gate_infra() {
  if ! have helm; then
    skip "infra: helm" "helm が無い"
    return
  fi
  step "infra: helm lint" . helm lint infra/helm/d-party
  step "infra: helm template (defaults)" . helm template d-party infra/helm/d-party
  step "infra: helm template (existingSecret + domain)" . helm_template_prod
}

# ── リポジトリ全体 ───────────────────────────────────────────────────────────
# CI はクリーンな checkout を見る。手元の未追跡ファイルを巻き込まないよう、追跡中のものに絞る。
shellcheck_all() {
  local files
  mapfile -t files < <(git ls-files '*.sh')
  shellcheck "${files[@]}"
}

yamllint_all() {
  local files
  mapfile -t files < <(git ls-files '*.yml' '*.yaml' '.yamllint')
  yamllint "${files[@]}"
}

gate_repo() {
  if have actionlint; then step "repo: actionlint" . actionlint; else skip "repo: actionlint" "actionlint が無い"; fi
  if have shellcheck; then step "repo: shellcheck" . shellcheck_all; else skip "repo: shellcheck" "shellcheck が無い"; fi
  if have yamllint; then step "repo: yamllint" . yamllint_all; else skip "repo: yamllint" "yamllint が無い"; fi
}

# ── イメージのビルド ─────────────────────────────────────────────────────────
# 起動後の疎通（migrate · API 応答 · ページ疎通）と hadolint · dockle は
# Backend/Build · Frontend/Build が PR ごとに見る。
gate_docker() {
  step "docker: backend image" . docker build -t d-party-backend:gates backend
  step "docker: frontend image" . docker build -f frontend/Dockerfile -t d-party-frontend:gates .
}

# ── 実行 ─────────────────────────────────────────────────────────────────────
if [ $# -eq 0 ]; then
  SECTIONS=("${ALL_SECTIONS[@]}")
else
  SECTIONS=("$@")
fi

# 途中まで回してから止まらないよう、名前を先に確かめる。
for section in "${SECTIONS[@]}"; do
  case " ${ALL_SECTIONS[*]} " in
    *" $section "*) ;;
    *)
      echo "unknown section: $section（${ALL_SECTIONS[*]}）" >&2
      exit 2
      ;;
  esac
done

for section in "${SECTIONS[@]}"; do
  case "$section" in
    backend) gate_backend ;;
    web) gate_web ;;
    bundle) gate_bundle ;;
    smoke) gate_smoke ;;
    compose) gate_compose ;;
    nginx) gate_nginx ;;
    infra) gate_infra ;;
    repo) gate_repo ;;
    docker) gate_docker ;;
  esac
done

failed=0
printf '\n%-50s %-6s %5s\n' "CHECK" "RESULT" "SEC"
for i in "${!NAMES[@]}"; do
  printf '%-50s %-6s %5s  %s\n' "${NAMES[$i]}" "${STATUSES[$i]}" "${SECONDS_TAKEN[$i]}" "${NOTES[$i]}"
  [ "${STATUSES[$i]}" = FAIL ] && failed=1
done

# 落ちた検査はログの末尾を出す。足りなければログを grep する（全部は読まない）。
for i in "${!NAMES[@]}"; do
  [ "${STATUSES[$i]}" = FAIL ] || continue
  printf '\n── %s（末尾 %s 行）\n' "${NAMES[$i]}" "${GATES_TAIL:-25}"
  tail -n "${GATES_TAIL:-25}" "${NOTES[$i]}"
done
printf '\nログ: %s\n' "$LOG_DIR"
exit "$failed"
