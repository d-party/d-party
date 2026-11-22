"""管理画面トップのコールバック（``settings.UNFOLD`` から参照）。"""

from __future__ import annotations

from django.conf import settings
from django.utils.timezone import localdate

from streamer.models import AnimeRoom, AnimeUser, ReactionType
from streamer.reactions import reaction_counts_by_type


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


def dashboard_callback(request, context):
    """トップページへ KPI カードとリアクション内訳を追加する。"""
    today = localdate()

    alive_rooms = AnimeRoom.objects.alive().count()
    alive_users = AnimeUser.objects.alive().count()
    rooms_today = AnimeRoom.objects.filter(created_at__date=today).count()

    breakdown, total_reactions = _reaction_breakdown()

    context.update(
        {
            "dp_cards": [
                {
                    "title": "アクティブなルーム",
                    "value": alive_rooms,
                    "icon": "meeting_room",
                    "description": "現在 alive な視聴ルーム",
                },
                {
                    "title": "接続中ユーザー",
                    "value": alive_users,
                    "icon": "group",
                    "description": "現在 alive な参加ユーザー",
                },
                {
                    "title": "本日作成ルーム",
                    "value": rooms_today,
                    "icon": "today",
                    "description": "論理削除済みを含む本日の作成数",
                },
                {
                    "title": "累計リアクション",
                    "value": f"{total_reactions:,}",
                    "icon": "favorite",
                    "description": "ReactionStat + 未畳み込みの合算",
                },
            ],
            "dp_reaction_breakdown": breakdown,
        }
    )
    return context
