"""Force-close rooms that have outlived the maximum room lifetime.

A room normally ends when its host deletes it or when it stays empty past the
grace period. Rooms that miss both paths stay ``alive`` and keep counting as
active in the statistics, so this command closes every room created more than
``--hours`` ago (48 by default), whether or not anyone is still connected.

Closing a room is the same as a host delete: the room's reactions are folded
into ``ReactionStat``, its users and the room are logically deleted, and
``room_deleted`` is pushed to whoever is still connected. Meant to run from
cron; safe to run repeatedly and concurrently.
"""

import datetime
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.timezone import now

from streamer.format import RoomSend, ServerMessage
from streamer.models import AnimeRoom, AnimeUser
from streamer.reactions import fold_room_reactions

logger = logging.getLogger(__name__)

DEFAULT_MAX_AGE_HOURS = 48


def close_room(room_id) -> bool:
    """Fold reactions and logically delete the room and its users.

    Returns ``False`` if the room was already closed by someone else (a host
    delete or another run of this command racing this one).
    """
    with transaction.atomic():
        fold_room_reactions(room_id)
        closed = AnimeRoom.objects.alive().filter(room_id=room_id).delete()
        if not closed:
            return False
        AnimeUser.objects.alive().filter(room_id=room_id).delete()
    return True


def notify_room_deleted(room_id) -> None:
    """Tell the connections still in the room that it is gone (best effort).

    The database is already consistent at this point, so a channel layer
    failure (e.g. Redis unreachable) must not fail the run.
    """
    message = RoomSend(
        response=ServerMessage(message_type="room_deleted"),
        sender_channel_name="",
    )
    try:
        async_to_sync(get_channel_layer().group_send)(
            str(room_id), message.model_dump(mode="json")
        )
    except Exception:
        logger.exception("failed to notify room %s of its deletion", room_id)


class Command(BaseCommand):
    help = (
        "Force-close (logically delete) AnimeRoom rows still alive after the "
        "maximum room lifetime, together with their users."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--hours",
            type=int,
            default=DEFAULT_MAX_AGE_HOURS,
            help="Close rooms created more than this many hours ago "
            f"(default: {DEFAULT_MAX_AGE_HOURS}).",
        )

    def handle(self, *args, **options):
        hours = options["hours"]
        if hours < 1:
            raise CommandError("--hours must be 1 or greater")
        cutoff = now() - datetime.timedelta(hours=hours)
        room_ids = list(
            AnimeRoom.objects.alive()
            .filter(created_at__lt=cutoff)
            .values_list("room_id", flat=True)
        )
        closed = 0
        for room_id in room_ids:
            if close_room(room_id):
                notify_room_deleted(room_id)
                closed += 1
        self.stdout.write(
            self.style.SUCCESS(f"closed {closed} room(s) older than {hours} hour(s)")
        )
