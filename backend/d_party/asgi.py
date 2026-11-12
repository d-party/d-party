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

# 拡張機能（D_ANIME_STORE_DOMAIN）に加え、タイマー画面のフロント（MY_DOMAIN）も許可する。
_my_domain = os.environ["MY_DOMAIN"]
allowed_hosts += [_my_domain, "www." + _my_domain]

if settings.DEBUG:
    allowed_hosts += ["*"]


application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # 認証を使わないので AuthMiddlewareStack は挟まない。
        "websocket": OriginValidator(
            URLRouter(streamer.routing.websocket_urlpatterns), allowed_hosts
        ),
    }
)
