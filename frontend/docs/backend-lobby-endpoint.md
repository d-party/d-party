# バックエンド API: ロビー解決エンドポイント

> **実装状況:** `backend` 側で実装済み（`api.views.AnimeStoreLobbyResolveAPI` /
> `api/urls.py` の `v1/anime-store/lobby/<uuid:room_id>`）。本ドキュメントは仕様の記録。

フロントエンドのルーム遷移ページ（`/anime-store/lobby/[roomId]`）は、`room_id` から
dアニメストアのリダイレクト URL を解決するためにこの REST エンドポイントを使用します。
これは旧 Django テンプレートビュー `web/views.py:AnimeRoomLobby` がサーバ側で行っていた処理の置き換えです。

> **サブモジュール運用ルール:** このエンドポイントは `backend`（[d-party-Backend](https://github.com/d-party/d-party-Backend)）
> リポジトリ側で別ブランチ・別 PR として実装してください。ルートリポジトリでは backend の参照 SHA のみ更新します。
> フロントエンド側では `openapi/openapi.json` にスキーマを定義済みで、`pnpm api:generate` でクライアント生成も完了しています。

## 仕様

```
GET /api/v1/anime-store/lobby/{room_id}
```

| 項目 | 内容 |
| --- | --- |
| 認証 | 不要（`AllowAny`） |
| パスパラメータ | `room_id` … ルーム UUID |
| 200 応答 | `{ "redirect_url": string, "part_id": string, "room_id": string }` |
| 404 応答 | `{ "message": string }`（ルーム不在 / `deleted_at` が非 null） |

`redirect_url` は旧 `AnimeRoomLobby.get()` と同一ロジックで組み立てます（`D_ANIME_STORE_DOMAIN` 既定
`animestore.docomo.ne.jp`、`partId` / `party=join` / `room_id` をクエリに付与）。

## 実装例（`api/views.py`）

```python
import os
import urllib.parse

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from streamer.models import AnimeRoom


class AnimeStoreLobbyResolveAPI(APIView):
    """Resolve a room id to the dアニメストア redirect URL (replaces AnimeRoomLobby)."""

    permission_classes = [AllowAny]

    def get(self, request, room_id, format=None) -> Response:
        anime_store_domain = os.environ.get(
            "D_ANIME_STORE_DOMAIN", "animestore.docomo.ne.jp"
        )
        try:
            anime_room = AnimeRoom.objects.get(room_id=room_id)
        except AnimeRoom.DoesNotExist:
            return Response(
                {"message": "ルームが見つかりません"},
                status=status.HTTP_404_NOT_FOUND,
            )
        if anime_room.deleted_at is not None:
            return Response(
                {"message": "ルームは終了しています"},
                status=status.HTTP_404_NOT_FOUND,
            )

        base_url = f"https://{anime_store_domain}/animestore/sc_d_pc?"
        url_param = urllib.parse.urlencode(
            {
                "partId": anime_room.part_id,
                "party": "join",
                "room_id": str(room_id),
            }
        )
        return Response(
            {
                "redirect_url": base_url + url_param,
                "part_id": anime_room.part_id,
                "room_id": str(room_id),
            },
            status=status.HTTP_200_OK,
        )
```

## ルーティング（`api/urls.py`）

```python
path(
    "v1/anime-store/lobby/<uuid:room_id>",
    views.AnimeStoreLobbyResolveAPI.as_view(),
),
```

## 移行後の旧ルートの扱い

旧 `web/urls.py` の `path("anime-store/lobby/<uuid:room_id>", views.AnimeRoomLobby.as_view())` は、
公開ページのリバースプロキシ（nginx）でフロントエンド（Next.js）へ振り替えるか、削除します。
拡張機能 manifest の content script match（`https://d-party.net/anime-store/lobby/*`）は変更不要です。

## 検証

```bash
# backend 起動後
curl -i http://localhost/api/v1/anime-store/lobby/<existing-room-uuid>   # → 200 + redirect_url
curl -i http://localhost/api/v1/anime-store/lobby/00000000-0000-0000-0000-000000000000  # → 404
```
