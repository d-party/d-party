"""Reap stale "alive" rooms / users left behind by an ungraceful shutdown.

On a hard crash ``disconnect`` never runs, so rows stay ``alive``. Only rows
whose ``updated_at`` is older than ``STALE_AFTER`` are closed, which leaves the
live sessions of other replicas alone. Safe to run on every start.
"""

import datetime

from django.core.management.base import BaseCommand
from django.utils.timezone import now

from streamer.models import AnimeRoom, AnimeUser

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
        room_count = rooms.count()
        users.delete()
        rooms.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"closed {user_count} stale user(s) and {room_count} stale room(s)"
            )
        )
