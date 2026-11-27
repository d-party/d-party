"""管理画面トップのコールバック（``settings.UNFOLD`` から参照）。"""

from __future__ import annotations

from typing import TYPE_CHECKING

from django.conf import settings
from django.utils.timezone import localdate

from streamer.models import SERVICES, ReactionType
from streamer.reactions import reaction_counts_by_type

if TYPE_CHECKING:
    from collections.abc import Callable

    from streamer.models import Service


def environment_callback(request):
    """右上に表示する環境バッジ ``[ラベル, 色]`` を返す。

    色は unfold のラベル種別（``success`` / ``warning`` / ``danger`` / ``info``）。
    """
    if settings.DEBUG:
        return ["Development", "warning"]
    return ["Production", "danger"]


def _reaction_breakdown():
    """種別ごとの累計リアクション数を、多い順の内訳と合計にして返す。"""
    counts = reaction_counts_by_type()
    total = counts.total()
    by_count = sorted(
        ReactionType.choices, key=lambda choice: counts[choice[0]], reverse=True
    )
    breakdown = [
        {
            "label": label,
            "count": counts[value],
            "percent": round(counts[value] / total * 100) if total else 0,
        }
        for value, label in by_count
    ]
    return breakdown, total


def _count_services(count: Callable[[Service], int]) -> tuple[int, str]:
    """全サービスの合計と、``"dアニメストア 3 · DMM TV 1"`` の形のサービス別の内訳を返す。"""
    counts = [(service.label, count(service)) for service in SERVICES]
    total = sum(n for _, n in counts)
    breakdown = " · ".join(f"{label} {n:,}" for label, n in counts)
    return total, breakdown


def dashboard_callback(request, context):
    """トップページへ KPI カードとリアクション内訳を追加する。

    ルーム・ユーザーの数は全サービス（``SERVICES``）の合計で、説明にサービス別の内訳を出す。
    """
    today = localdate()

    alive_rooms, alive_rooms_by_service = _count_services(
        lambda service: service.room.objects.alive().count()
    )
    alive_users, alive_users_by_service = _count_services(
        lambda service: service.user.objects.alive().count()
    )
    rooms_today, rooms_today_by_service = _count_services(
        lambda service: service.room.objects.filter(created_at__date=today).count()
    )

    breakdown, total_reactions = _reaction_breakdown()

    context.update(
        {
            "dp_cards": [
                {
                    "title": "アクティブなルーム",
                    "value": alive_rooms,
                    "icon": "meeting_room",
                    "description": f"現在 alive な視聴ルーム（{alive_rooms_by_service}）",
                },
                {
                    "title": "接続中ユーザー",
                    "value": alive_users,
                    "icon": "group",
                    "description": f"現在 alive な参加ユーザー（{alive_users_by_service}）",
                },
                {
                    "title": "本日作成ルーム",
                    "value": rooms_today,
                    "icon": "today",
                    "description": (
                        f"論理削除済みを含む本日の作成数（{rooms_today_by_service}）"
                    ),
                },
                {
                    "title": "累計リアクション",
                    "value": f"{total_reactions:,}",
                    "icon": "favorite",
                    "description": "全サービスの集計 + 未畳み込みの合算",
                },
            ],
            "dp_reaction_breakdown": breakdown,
        }
    )
    return context
