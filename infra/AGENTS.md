# AGENTS.md — infra

Raspberry Pi (arm64) の k3s クラスタへ Helm でデプロイし、Argo CD で GitOps する。
手順と構成図は [README.md](README.md) と [platform/README.md](platform/README.md)。

```
helm/d-party/   d-party の Helm chart（nginx · django · frontend · postgres · redis · migrate hook
                · networkpolicy · priorityclass · ingress（任意））
platform/       クラスタ共有の基盤（ローカルレジストリと各ノードの registries.yaml）
cloudflare/     オリジン到達不能時にメンテナンスページを返す Cloudflare Worker（手動で wrangler deploy）
build/          rootless BuildKit で arm64 ネイティブビルドし、共有レジストリへ push する Job
argocd/         Argo CD Application の雛形（実体は運用リポジトリ）
```

## docker compose との違い

- ドメインと TLS は Cloudflare Tunnel（cloudflared）がエッジで終端する。chart は
  クラスタ内 HTTP だけを扱い、nginx は `ClusterIP`。cloudflared・ドメイン・Argo CD 本体は
  別の運用リポジトリの管轄。
- 同じクラスタに他サービスが同居する前提。リソース名は release 名で prefix し、namespace は固定しない。
  `replicaCount` の既定は 1。
- postgres / redis は chart に同梱し、他サービスと共有しない。`NetworkPolicy` で同じ release
  からしか届かないようにし、`PriorityClass`（stateful > app）でメモリ逼迫時も DB を守る。
- `platform/` は d-party の持ち物ではない。chart は「既にある共有レジストリ」として参照するだけ。
- `SECRET_KEY` / `POSTGRES_PASSWORD` は values に書かず `secret.existingSecret` で渡す。
  `config.MY_DOMAIN` は 1 ドメインのみ。
- backend イメージは compose と同じものを使い、gunicorn の設定は env で上書きする。
  django はローリング更新で新 Pod を先に Ready にする。既存の WebSocket は旧 Pod の停止時に
  1012 で切れ、拡張機能は自動再接続しない。

## メンテナンスページ

- ページは `helm/d-party/files/maintenance.html` の 1 本だけ。chart の nginx・本番 compose の
  nginx・`cloudflare/maintenance-worker` が同じファイルを使う。外部の CSS や画像を読ませない
  （オリジンが落ちているときに出すページなので）。
- nginx は upstream に届かないとき（502 / 504）と計画メンテナンス（`nginx.maintenance.enabled`）の
  ときにこのページを 503 で返す。`proxy_intercept_errors` は入れない。django が返す
  `/api/v1/health` の 503 をそのまま通すため。
- `/healthz` はメンテナンス中も 200 のままにする（nginx の probe が使う）。
- Worker は 503 を差し替えない（nginx のページと `/api/v1/health` を通すため）。手順は README の 7 章。

```bash
helm lint infra/helm/d-party
helm template d-party infra/helm/d-party | less

k3d cluster create d-party --agents 2
helm upgrade --install d-party infra/helm/d-party -n d-party --create-namespace \
  --set config.MY_DOMAIN=d-party.example --set secret.existingSecret=d-party-secret
k3d cluster delete d-party
```
