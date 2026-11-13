"""ASGI entrypoint: HTTP goes to Django, WebSocket to the Channels party consumer."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "d_party.settings")

django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator
from django.conf import settings

import streamer.routing

# 拡張機能は dアニメストアのページから、タイマー画面は公開サイトからつなぐ。
# OriginValidator は scheme を省いた値をホスト名として照合し、既定ポートも同一視する。
allowed_origins = [
    settings.D_ANIME_STORE_DOMAIN,
    settings.MY_DOMAIN,
    f"www.{settings.MY_DOMAIN}",
]
if settings.DEBUG:
    allowed_origins.append("*")

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # 認証を使わないので AuthMiddlewareStack は挟まない。
        "websocket": OriginValidator(
            URLRouter(streamer.routing.websocket_urlpatterns), allowed_origins
        ),
    }
)
