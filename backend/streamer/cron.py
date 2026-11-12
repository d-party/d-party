"""Reaction folding on room end.

A room's per-tap ``AnimeReaction`` rows are folded into the compact
``ReactionStat`` aggregate the moment the room ends (host delete / grace-period
delete) and the raw rows are hard-deleted, so the database only retains
aggregates. Despite the module name this is *not* a scheduled job: it runs from
``consumers.py`` (and ``close_active_sessions``) when a room ends.
"""

from django.db import transaction
from django.db.models import Count, F
from django.db.models.functions import TruncDate

from .models import AnimeReaction, ReactionStat


def fold_room_reactions(room_id, *, reaction_model=None, stat_model=None) -> None:
    """Fold a room's reactions into the stat aggregate then hard-delete the rows.

    Called whenever a room ends (host delete / grace-period delete). Reactions
    are aggregated per ``(creation day, reaction_type)`` and added to the
    matching stat row (created if missing), so the raw reaction rows can be
    removed for good — only aggregates remain.

    ``reaction_model`` / ``stat_model`` はサービス別に差し替える（dアニメ /
    DMM）。未指定なら従来どおり dアニメの ``AnimeReaction`` → ``ReactionStat``。
    ロックするルームは ``reaction_model`` の ``room_id`` 外部キーの参照先から決める。

    The room row is locked for the duration so two concurrent endings of the
    same room (e.g. host delete racing the grace-period delete) cannot both
    count the same reactions, and the increment and the delete commit together.
    """
    reaction_model = reaction_model or AnimeReaction
    stat_model = stat_model or ReactionStat
    room_model = reaction_model._meta.get_field("room_id").related_model
    with transaction.atomic():
        list(room_model.objects.select_for_update().filter(room_id=room_id))
        rows = (
            reaction_model.objects.filter(room_id=room_id)
            .annotate(day=TruncDate("created_at"))
            .values("day", "reaction_type")
            .annotate(n=Count("reaction_id"))
        )
        for row in rows:
            _, created = stat_model.objects.get_or_create(
                date=row["day"],
                reaction_type=row["reaction_type"],
                defaults={"count": row["n"]},
            )
            if not created:
                stat_model.objects.filter(
                    date=row["day"], reaction_type=row["reaction_type"]
                ).update(count=F("count") + row["n"])
        reaction_model.objects.filter(room_id=room_id).delete(hard=True)
