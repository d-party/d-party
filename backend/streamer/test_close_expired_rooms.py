"""Tests for the scheduled room reaper (``close_expired_rooms``).

Rooms created more than the maximum lifetime ago are force-closed even when
they are still in use; younger rooms are left alone.
"""

import datetime

import pytest
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from .factories import AnimeRoomFactory, AnimeUserFactory
from .models import AnimeReaction, AnimeRoom, AnimeUser, ReactionStat


def _make_room(age: datetime.timedelta, *, users: int = 1) -> AnimeRoom:
    """Create an alive room of the given age that was touched just now."""
    room = AnimeRoomFactory()
    # auto_now_add / auto_now ignore the values passed on create.
    AnimeRoom.objects.filter(pk=room.pk).update(
        created_at=timezone.now() - age, updated_at=timezone.now()
    )
    for _ in range(users):
        AnimeUserFactory(room_id=room)
    return room


def _is_alive(room: AnimeRoom) -> bool:
    return AnimeRoom.objects.alive().filter(pk=room.pk).exists()


@pytest.mark.django_db
def test_closes_rooms_older_than_48_hours_even_if_in_use():
    expired = _make_room(datetime.timedelta(hours=49), users=2)
    young = _make_room(datetime.timedelta(hours=47), users=2)

    call_command("close_expired_rooms")

    # 直近に更新されていても（＝利用中でも）48 時間を超えたルームは閉じる。
    assert _is_alive(expired) is False
    assert AnimeUser.objects.alive().filter(room_id=expired).count() == 0
    assert _is_alive(young) is True
    assert AnimeUser.objects.alive().filter(room_id=young).count() == 2


@pytest.mark.django_db
def test_folds_reactions_of_closed_rooms():
    expired = _make_room(datetime.timedelta(hours=49))
    young = _make_room(datetime.timedelta(hours=1))
    AnimeReaction.objects.create(room_id=expired, reaction_type="S")
    AnimeReaction.objects.create(room_id=expired, reaction_type="S")
    AnimeReaction.objects.create(room_id=young, reaction_type="S")

    call_command("close_expired_rooms")

    assert AnimeReaction.objects.filter(room_id=expired).count() == 0
    assert ReactionStat.objects.get(reaction_type="S").count == 2
    assert AnimeReaction.objects.filter(room_id=young).count() == 1


@pytest.mark.django_db
def test_notifies_connections_still_in_the_room():
    expired = _make_room(datetime.timedelta(hours=49))
    layer = get_channel_layer()
    channel = async_to_sync(layer.new_channel)()
    async_to_sync(layer.group_add)(str(expired.room_id), channel)

    call_command("close_expired_rooms")

    message = async_to_sync(layer.receive)(channel)
    assert message["type"] == "room_send"
    assert message["response"]["action"] == "server_message"
    assert message["response"]["message_type"] == "room_deleted"


@pytest.mark.django_db
def test_hours_option_and_idempotency():
    room = _make_room(datetime.timedelta(hours=3))

    call_command("close_expired_rooms")
    assert _is_alive(room) is True

    call_command("close_expired_rooms", hours=2)
    assert _is_alive(room) is False
    deleted_at = AnimeRoom.objects.get(pk=room.pk).deleted_at

    # 既に閉じたルームには触らない。
    call_command("close_expired_rooms", hours=2)
    assert AnimeRoom.objects.get(pk=room.pk).deleted_at == deleted_at


@pytest.mark.django_db
def test_rejects_non_positive_hours():
    with pytest.raises(CommandError):
        call_command("close_expired_rooms", hours=0)
