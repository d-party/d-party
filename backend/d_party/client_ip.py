"""リクエストを送ってきたクライアントの IP。django-axes のロックに使う。

本番は Cloudflare → cloudflared → nginx → Django とつながるので、``REMOTE_ADDR`` は
nginx の Pod になる。クライアントの IP は Cloudflare が付ける ``CF-Connecting-IP`` で取る。
Cloudflare はクライアントが送った同名のヘッダーを上書きするので、Cloudflare を通る限り
偽れない。nginx は cloudflared の後ろの ClusterIP で、外から直接は届かない。
"""

import ipaddress
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.http import HttpRequest


def client_ip(request: HttpRequest) -> str | None:
    """``CF-Connecting-IP`` が IP として読めればそれ、なければ ``REMOTE_ADDR``。"""
    forwarded = request.META.get("HTTP_CF_CONNECTING_IP", "").strip()
    if forwarded:
        try:
            return str(ipaddress.ip_address(forwarded))
        except ValueError:
            pass
    return request.META.get("REMOTE_ADDR")
