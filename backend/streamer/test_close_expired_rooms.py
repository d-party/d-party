"""Tests for the scheduled room reaper (``close_expired_rooms``).

Rooms created more than the maximum lifetime ago are force-closed even when
they are still in use; younger rooms are left alone.
"""

import datetime
import io

import pytest
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from .factories import (
    AnimeRoomFactory,
    AnimeUserFactory,
    DmmRoomFactory,
    DmmUserFactory,
)
from .models import (
    ANIME_STORE,
    AnimeReaction,
    AnimeRoom,
    AnimeUser,
    DmmReaction,
    DmmReactionStat,
    DmmRoom,
    DmmUser,
    ReactionStat,
)


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


def _make_dmm_room(age: datetime.timedelta, *, users: int = 1) -> DmmRoom:
    """``_make_room`` の DMM TV 版。"""
    room = DmmRoomFactory()
    DmmRoom.objects.filter(pk=room.pk).update(
        created_at=timezone.now() - age, updated_at=timezone.now()
    )
    for _ in range(users):
        DmmUserFactory(room_id=room)
    return room


def _is_alive(room: AnimeRoom | DmmRoom) -> bool:
    return type(room).objects.alive().filter(pk=room.pk).exists()


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


@pytest.mark.django_db
def test_close_room_reports_a_room_someone_else_already_closed():
    from .management.commands.close_expired_rooms import close_room

    room = _make_room(datetime.timedelta(hours=49))
    user = AnimeUser.objects.get(room_id=room)
    room.delete()

    assert close_room(room.pk, service=ANIME_STORE) is False
    # ルームを閉じた側がユーザーも閉じる。負けた側は触らない。
    assert AnimeUser.objects.alive().filter(pk=user.pk).exists()


@pytest.mark.django_db
def test_room_closed_by_a_concurrent_run_is_not_counted_or_notified(monkeypatch):
    from .management.commands import close_expired_rooms

    _make_room(datetime.timedelta(hours=49))
    notified = []
    monkeypatch.setattr(
        close_expired_rooms, "close_room", lambda room_id, *, service: False
    )
    monkeypatch.setattr(close_expired_rooms, "notify_room_deleted", notified.append)
    out = io.StringIO()

    call_command("close_expired_rooms", stdout=out)

    assert notified == []
    assert "closed 0 room(s)" in out.getvalue()


@pytest.mark.django_db
def test_channel_layer_failure_does_not_fail_the_run(monkeypatch, caplog):
    from .management.commands import close_expired_rooms

    class BrokenLayer:
        async def group_send(self, group, message):
            raise ConnectionError("redis is down")

    expired = _make_room(datetime.timedelta(hours=49))
    monkeypatch.setattr(close_expired_rooms, "get_channel_layer", BrokenLayer)
    out = io.StringIO()

    call_command("close_expired_rooms", stdout=out)

    assert not _is_alive(expired)
    assert "closed 1 room(s)" in out.getvalue()
    assert f"failed to notify room {expired.pk}" in caplog.text


@pytest.mark.django_db
def test_closes_expired_dmm_rooms_too():
    expired = _make_dmm_room(datetime.timedelta(hours=49), users=2)
    young = _make_dmm_room(datetime.timedelta(hours=47), users=2)
    anime = _make_room(datetime.timedelta(hours=49))
    out = io.StringIO()

    call_command("close_expired_rooms", stdout=out)

    assert _is_alive(expired) is False
    assert DmmUser.objects.alive().filter(room_id=expired).count() == 0
    assert _is_alive(young) is True
    assert DmmUser.objects.alive().filter(room_id=young).count() == 2
    assert _is_alive(anime) is False
    assert "closed 2 room(s)" in out.getvalue()


@pytest.mark.django_db
def test_folds_reactions_of_closed_dmm_rooms_into_dmm_stats():
    expired = _make_dmm_room(datetime.timedelta(hours=49))
    DmmReaction.objects.create(room_id=expired, reaction_type="S")
    DmmReaction.objects.create(room_id=expired, reaction_type="C")

    call_command("close_expired_rooms")

    assert DmmReaction.objects.filter(room_id=expired).count() == 0
    assert DmmReactionStat.objects.get(reaction_type="S").count == 1
    assert DmmReactionStat.objects.get(reaction_type="C").count == 1
    # dアニメストアの集計には混ぜない。
    assert ReactionStat.objects.exists() is False


@pytest.mark.django_db
def test_notifies_connections_still_in_a_dmm_room():
    expired = _make_dmm_room(datetime.timedelta(hours=49))
    layer = get_channel_layer()
    channel = async_to_sync(layer.new_channel)()
    async_to_sync(layer.group_add)(str(expired.room_id), channel)

    call_command("close_expired_rooms")

    message = async_to_sync(layer.receive)(channel)
    assert message["response"]["message_type"] == "room_deleted"
