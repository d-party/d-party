# deploy/platform/ — クラスタ共有基盤（d-party 専用ではない）

ここにあるのは **クラスタに 1 回だけ用意する共有シングルトン**です。d-party 固有では
なく、**同じ k3s クラスタに同居する他サービスからも共用**されます。

| ファイル | 中身 | スコープ |
|---|---|---|
| `registry.yaml` | クラスタ内ローカルレジストリ（`registry:2`）＋ `registry` Namespace ＋ NodePort `30500` | クラスタ全体（singleton） |
| `k3s-registries.yaml` | 各ノードの `/etc/rancher/k3s/registries.yaml`（containerd のミラー設定） | ノード全体（singleton） |

## なぜ d-party の Helm chart に入れないのか

これらは **Namespace 横断・ノードグローバルな資産**で、特定アプリの所有物ではありません。
d-party の chart（`../helm/d-party`）に同梱すると「d-party を入れないと他サービスが
ビルド／pull できない」という不健全な依存になります。そのため：

- d-party の **chart はここを所有しない**。`registry.registry.svc.cluster.local:5000` を
  「既にある共有レジストリ」として **参照するだけ**（`values.*.image.repository`）。
- ビルド Job（`../build/`）も同様に、この共有レジストリへ **push するだけ**の利用者。

## 理想形

将来サービスが増えるなら、この `platform/` 一式は **別の「クラスタ基盤
（platform / cluster-bootstrap）リポジトリ」へ切り出す**のが望ましいです。本リポジトリには
「d-party を動かすのに必要な前提」として暫定的に置いてあります。

## 適用（クラスタ初期化時に 1 回だけ）

```bash
# 1) 共有レジストリ
kubectl apply -f deploy/platform/registry.yaml

# 2) 全ノードに registries.yaml を配置して k3s 再起動
sudo cp deploy/platform/k3s-registries.yaml /etc/rancher/k3s/registries.yaml
sudo systemctl restart k3s          # server ノード
sudo systemctl restart k3s-agent    # agent(worker) ノード
```
