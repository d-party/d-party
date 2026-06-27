Argo CD GitOps — release → 自動デプロイ
このディレクトリは d-party の CD の入口（Argo CD Application）と、その運用メモをまとめる。 本番想定の k3s クラスタ（Raspberry Pi / arm64）で、backend・frontend の release を契機に 自動でローリングデプロイされる仕組みを構築済み。

方針: AGENTS.md の通り、Argo CD 本体・Application の「実体」は本来クラスタ運用リポジトリの 管轄。ここに置く application.yaml は当面の実体兼参照であり、最終的には ops リポジトリへ 切り出すのが理想。application.example.yaml は汎用サンプル（ドメイン非依存）。

デプロイの流れ
backend / frontend を release
  └─ GHCR に不変 semver タグを publish:  ghcr.io/d-party/{backend,frontend}:vX.Y.Z
        │
        ▼  argocd-image-updater が 2 分間隔で GHCR を走査
   新しい semver を検出 → d-party Application の helm パラメータ
   （django.image.tag / frontend.image.tag）を書き換え（write-back: argocd 方式）
        │
        ▼  Argo CD の automated(selfHeal) が desired 変更を検知
   deploy/helm/d-party を render → ローリング更新で自動デプロイ
「release のタイミング」= GHCR に新しい semver イメージが出た時。image-updater が ポーリングで検出するため、git への追加コミットは不要。
chart 既定の image.tag: v0.0.0 はプレースホルダ。Application 側の valuesObject （初期 = 現行版）と image-updater が書き込む helm パラメータが常に上書きするため、 v0.0.0 が実体に出ることはない。
構成（クラスタに導入済み・in-cluster）
コンポーネント	内容
Argo CD	argocd namespace に標準インストール（server-side apply）。CD 本体。
argocd-image-updater	**v0.18.0（注釈方式）**を kubernetes モードで導入。GHCR を監視し Application を更新。
Application d-party	deploy/argocd/application.yaml。deploy/helm/d-party を main から render。
公開は Cloudflare Named Tunnel（cloudflared namespace）→ stg.d-party.net。 TLS はエッジ（Universal SSL）で終端。chart はクラスタ内 HTTP のみ扱う。

Application のポイント（application.yaml）
source: https://github.com/d-party/d-party の deploy/helm/d-party（main 追従）。
helm.valuesObject: config.MY_DOMAIN: stg.d-party.net / secret.existingSecret: d-party-secret / 初期 django.image.tag frontend.image.tag（= 現行版。以後 image-updater が上書き）。
syncPolicy.automated: prune: true / selfHeal: true。ServerSideApply=true。
ignoreDifferences: StatefulSet の volumeClaimTemplates 補完フィールドを無視（下記参照）。
image-updater 注釈: image-list に backend/frontend、update-strategy: semver、 *.helm.image-tag で書き戻し先を指定。
構築時に踏んだ要注意ポイント（恒久対処済み）
repo-server のサブモジュール取得失敗 .gitmodules が SSH URL（git@github.com:...）のため、Argo CD repo-server が submodule clone で Permission denied (publickey) → manifest 生成不可。 chart はサブモジュール不要なので submodule 取得を無効化して解消:

kubectl -n argocd set env deploy/argocd-repo-server ARGOCD_GIT_MODULES_ENABLED=false
image-updater のバージョン選定 最新の v1.x は CRD ベース（ImageUpdater CR を処理）に刷新されており、本 repo の 設計が前提とする Application 注釈方式が効かない（"No ImageUpdater CRs to process"）。 注釈方式の v0.18.0 を採用し、applications_api: kubernetes（argocd-server トークン 不要・Application CR を直接読み書き）で運用する。

postgres StatefulSet が恒久 OutOfSync API サーバが volumeClaimTemplates に apiVersion / kind / status / spec.volumeMode を補完するため、Argo CD が差分を誤検出（kubectl diff / argocd app diff では空）。 redis は emptyDir（VCT なし）なので無関係。ignoreDifferences で補完フィールドのみ無視。

既存 Helm リリースからの adopt Helm 管理だった稼働リソースを Argo CD が ServerSideApply で adopt。初回 sync で Deployment 3 種は新 Pod にローリング（一回限り・無停止）。postgres/redis は再作成されず継続。

よく使う操作
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# アプリの状態
kubectl -n argocd get application d-party
kubectl -n argocd get application d-party -o jsonpath='{range .status.resources[*]}{.status} {.kind}/{.name}{"\n"}{end}'

# 手動リフレッシュ / sync
kubectl -n argocd annotate application d-party argocd.argoproj.io/refresh=hard --overwrite

# image-updater のスキャン結果
kubectl -n argocd logs deploy/argocd-image-updater --tail=50 | grep "Processing results"

# argocd CLI（core モード = API 直結、port-forward 不要）
argocd --core app diff d-party     # 要 ARGOCD_NAMESPACE=argocd または kube context の ns=argocd
動作テスト
次回 release（backend / frontend で新 semver を GHCR に publish）で実地確認できる。 2 分以内に image-updater が検出 → Application 更新 → Argo CD が自動デプロイ。 擬似確認するなら、Application のタグを一旦過去版へ下げ、image-updater が最新へ巻き戻すか観察する。

まだ git 化されていないもの（次の改善）
Argo CD 本体・image-updater のインストールとその設定（ARGOCD_GIT_MODULES_ENABLED, applications_api: kubernetes 等）は in-cluster のみ。再現性のため ops リポジトリへ。
cloudflared（Named Tunnel のトークン / Deployment）と DNS 割り当ても in-cluster / ダッシュボード。
image-updater の write-back を git 方式（ops リポジトリの values へコミット）に切り替えると、 稼働中バージョンが git で追跡可能になる（要 GitHub 書き込みトークン）。
