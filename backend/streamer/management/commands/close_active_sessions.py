"""Reap stale "alive" rooms / users left behind by an ungraceful shutdown.

Channels WebSocket session state lives only in the Django process
(`AnimePartyConsumer`). On a graceful shutdown each connection's
``disconnect`` fires and ``leave_party`` cleans up the rows, but on a hard
crash (OOMKill / node loss / SIGKILL) ``disconnect`` never runs and the
``AnimeRoom`` / ``AnimeUser`` rows stay ``alive`` forever — inflating the
``alive`` count stats.

``updated_at`` is *not* a heartbeat: it only moves when a row is saved (room
creation, a part_id change, a host promotion). The command therefore relies on
sessions not lasting longer than ``STALE_AFTER`` and closes only rows older than
that, instead of *all* alive rows, so a freshly started replica does not wipe
the sessions another replica is serving.

Stale rooms are closed the same way a room normally ends: their reactions are
folded into ``ReactionStat`` first, otherwise those reactions would drop out of
the statistics for good (live counts only include rooms that are still alive).

Idempotent, so it is fine to run unconditionally on every startup.
"""

import datetime

from django.core.management.base import BaseCommand
from django.utils.timezone import now

from streamer.cron import fold_room_reactions
from streamer.models import AnimeRoom, AnimeUser

# Sessions are not expected to last this long; anything older that is still
# marked alive is a leftover ghost from an ungraceful shutdown.
STALE_AFTER = datetime.timedelta(days=1)


class Command(BaseCommand):
    help = (
        "Logically delete AnimeRoom / AnimeUser rows still marked alive whose "
        "updated_at is older than the staleness threshold (leftover ghosts)."
    )

    def handle(self, *args, **options):
        cutoff = now() - STALE_AFTER
        users = AnimeUser.objects.alive().filter(updated_at__lt=cutoff)
        rooms = AnimeRoom.objects.alive().filter(updated_at__lt=cutoff)
        user_count = users.count()
        room_ids = list(rooms.values_list("room_id", flat=True))
        users.delete()
        for room_id in room_ids:
            fold_room_reactions(room_id)
        AnimeRoom.objects.filter(room_id__in=room_ids).delete()
        room_count = len(room_ids)
        self.stdout.write(
            self.style.SUCCESS(
                f"closed {user_count} stale user(s) and {room_count} stale room(s)"
            )
        )
