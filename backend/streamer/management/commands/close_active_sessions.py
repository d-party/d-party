"""Reap stale "alive" rooms / users left behind by an ungraceful shutdown.

Covers every streaming service in ``SERVICES`` (dアニメストア and DMM TV).

On a hard crash ``disconnect`` never runs, so rows stay ``alive``. ``updated_at``
is not a heartbeat (it only moves when a row is saved), so the command assumes
sessions do not outlast ``STALE_AFTER`` and closes only rows older than that,
which leaves the live sessions of other replicas alone. Safe to run on every start.

Stale rooms are closed the way a room normally ends: their reactions are folded
into their service's reaction stats first, otherwise they would drop out of the
statistics.
"""

import datetime

from django.core.management.base import BaseCommand
from django.utils.timezone import now

from streamer.models import SERVICES, Service
from streamer.reactions import fold_room_reactions

STALE_AFTER = datetime.timedelta(days=1)


class Command(BaseCommand):
    help = (
        "Logically delete room / user rows of every service still marked alive "
        "whose updated_at is older than the staleness threshold (leftover ghosts)."
    )

    def handle(self, *args, **options):
        cutoff = now() - STALE_AFTER
        user_count = room_count = 0
        for service in SERVICES:
            users, rooms = _close_stale(service, cutoff)
            user_count += users
            room_count += rooms
        self.stdout.write(
            self.style.SUCCESS(
                f"closed {user_count} stale user(s) and {room_count} stale room(s)"
            )
        )


def _close_stale(service: Service, cutoff: datetime.datetime) -> tuple[int, int]:
    """Close one service's stale users and rooms; return how many of each."""
    users = service.user.objects.alive().filter(updated_at__lt=cutoff)
    rooms = service.room.objects.alive().filter(updated_at__lt=cutoff)
    user_count = users.count()
    room_ids = list(rooms.values_list("room_id", flat=True))
    users.delete()
    for room_id in room_ids:
        fold_room_reactions(room_id, service=service)
    service.room.objects.filter(room_id__in=room_ids).delete()
    return user_count, len(room_ids)
