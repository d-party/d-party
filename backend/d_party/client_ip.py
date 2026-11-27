"""リクエストを送ってきたクライアントの IP。django-axes のロックに使う。

本番は Cloudflare → cloudflared → nginx → Django とつながるので、``REMOTE_ADDR`` は
nginx の Pod になる。クライアントの IP は Cloudflare が付ける ``CF-Connecting-IP`` で取る。
Cloudflare はクライアントが送った同名のヘッダーを上書きするので、Cloudflare を通る限り
偽れない。nginx は cloudflared の後ろの ClusterIP で、クラスタの外からは直接届かない
（クラスタ内の別の Pod からは届くので、同居するサービスは信頼している前提）。
"""

import ipaddress
import logging
from typing import TYPE_CHECKING

from django.conf import settings

if TYPE_CHECKING:
    from django.http import HttpRequest

logger = logging.getLogger(__name__)

# IPv6 は 1 契約者が /56〜/48 を持つので、アドレスごとに数えると、その中で回すだけで
# 試行回数の上限を回避できる。/56 でまとめて数える。
IPV6_PREFIX_LENGTH = 56


def _lockout_key(address: str) -> str:
    """ロックを数える単位。IPv4 はそのまま、IPv6 は /56 のネットワーク。"""
    ip = ipaddress.ip_address(address)
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped:
            return str(ip.ipv4_mapped)
        network = ipaddress.IPv6Network((ip, IPV6_PREFIX_LENGTH), strict=False)
        return str(network.network_address)
    return str(ip)


def client_ip(request: HttpRequest) -> str | None:
    """``CF-Connecting-IP`` が IP として読めればその単位、なければ ``REMOTE_ADDR``。"""
    forwarded = request.META.get("HTTP_CF_CONNECTING_IP", "").strip()
    if forwarded:
        try:
            return _lockout_key(forwarded)
        except ValueError:
            pass
    if not settings.DEBUG:
        # 本番で REMOTE_ADDR（nginx の Pod）に戻ると、全員が同じ IP として数えられ、
        # ユーザー名だけのロックと同じになる。黙って起きないように残す。
        logger.warning("no usable CF-Connecting-IP; falling back to REMOTE_ADDR")
    return request.META.get("REMOTE_ADDR")
