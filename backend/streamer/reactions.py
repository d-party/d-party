"""リアクションの集計。

タップごとの ``AnimeReaction`` は、ルームが終わった時点で日次 × 種別の ``ReactionStat``
へ畳み込み、元の行は物理削除する。したがって累計は「畳み込み済み」と「まだ生きている
ルームの未畳み込み分」の和になる。
"""

from collections import Counter
lazy import datetime

from django.db import transaction
from django.db.models import Count, F, Sum
from django.db.models.functions import TruncDate

from .models import AnimeReaction, AnimeRoom, ReactionStat


def fold_room_reactions(room_id) -> None:
    """ルームのリアクションを ``ReactionStat`` へ加算し、元の行を物理削除する。

    加算と削除を 1 トランザクションにして、途中で落ちても二重に数えない。ルームの行を
    ロックするので、同じルームの終了が重なっても（ホストの削除と猶予後の削除など）
    同じリアクションを 2 回数えない。
    """
    with transaction.atomic():
        list(AnimeRoom.objects.select_for_update().filter(room_id=room_id))
        reactions = AnimeReaction.objects.filter(room_id=room_id)
        rows = (
            reactions.annotate(day=TruncDate("created_at"))
            .values("day", "reaction_type")
            .annotate(n=Count("reaction_id"))
        )
        for row in rows:
            _, created = ReactionStat.objects.get_or_create(
                date=row["day"],
                reaction_type=row["reaction_type"],
                defaults={"count": row["n"]},
            )
            if not created:
                ReactionStat.objects.filter(
                    date=row["day"], reaction_type=row["reaction_type"]
                ).update(count=F("count") + row["n"])
        reactions.delete(hard=True)


def reaction_counts_by_type(since: datetime.date | None = None) -> Counter[str]:
    """種別（保存値。例 ``"S"``）ごとのリアクション数。``since`` 以降、省略時は全期間。"""
    folded = ReactionStat.objects.all()
    live = AnimeReaction.objects.filter(room_id__deleted_at__isnull=True)
    if since is not None:
        folded = folded.filter(date__gte=since)
        live = live.filter(created_at__date__gte=since)

    counts: Counter[str] = Counter()
    for row in folded.values("reaction_type").annotate(total=Sum("count")):
        counts[row["reaction_type"]] += row["total"]
    for row in live.values("reaction_type").annotate(total=Count("reaction_id")):
        counts[row["reaction_type"]] += row["total"]
    return counts
