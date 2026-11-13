"""リアクションの集計。

タップごとの ``AnimeReaction`` は、ルームが終わった時点で日次 × 種別の ``ReactionStat``
へ畳み込み、元の行は物理削除する。
"""

from django.db import transaction
from django.db.models import Count, F
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
