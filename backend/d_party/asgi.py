"""ASGI entrypoint: HTTP goes to Django, WebSocket to the Channels party consumer."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "d_party.settings")

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator
from django.conf import settings

import streamer.routing

# OriginValidator は scheme を省いた値をホスト名として照合し、既定ポートも同一視する。
allowed_hosts = [os.environ["D_ANIME_STORE_DOMAIN"]]

# タイマー画面は d-party フロントエンド（MY_DOMAIN）のオリジンから WebSocket を張り、
# spectate で観覧専用参加する。拡張機能（D_ANIME_STORE_DOMAIN）とは別オリジンのため、
# MY_DOMAIN 由来のオリジンも WS の OriginValidator に許可する（許可の拡大のみ）。
_my_domain = os.environ["MY_DOMAIN"]
allowed_hosts += [_my_domain, "www." + _my_domain]

if settings.DEBUG:
    allowed_hosts += ["*"]


application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # 同時視聴は認証を使わないので AuthMiddlewareStack（セッション参照）は挟まない。
        "websocket": OriginValidator(
            URLRouter(streamer.routing.websocket_urlpatterns), allowed_hosts
        ),
    }
)
