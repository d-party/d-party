"""論理削除（``mixins.py``）の意味のテスト。

``objects.alive()`` / ``delete()``（論理）/ ``delete(hard=True)``（物理）は
consumer・統計・管理画面が前提にしているので、ここで固定する。
"""

import pytest

from .factories import AnimeRoomFactory, AnimeUserFactory
from .models import AnimeRoom, AnimeUser

pytestmark = pytest.mark.django_db


def test_instance_delete_is_logical():
    room = AnimeRoomFactory()
    assert room.is_alive()
    assert not room.is_dead()

    assert room.delete() == (1, {"streamer.AnimeRoom": 1})

    assert room.is_dead()
    assert not room.is_alive()
    # 行は残り、deleted_at だけが DB に書かれる。
    stored = AnimeRoom.objects.get(pk=room.pk)
    assert stored.deleted_at == room.deleted_at


def test_instance_delete_hard_removes_the_row():
    room = AnimeRoomFactory()
    user = AnimeUserFactory(room_id=room)

    room.delete(hard=True)

    assert not AnimeRoom.objects.filter(pk=room.pk).exists()
    # ForeignKey の CASCADE も物理削除として効く。
    assert not AnimeUser.objects.filter(pk=user.pk).exists()


def test_instance_revive():
    room = AnimeRoomFactory()
    room.delete()

    room.revive()

    assert room.is_alive()
    assert AnimeRoom.objects.alive().filter(pk=room.pk).exists()


def test_alive_and_dead_split_the_rows():
    alive = AnimeRoomFactory()
    dead = AnimeRoomFactory()
    dead.delete()

    assert list(AnimeRoom.objects.alive()) == [alive]
    assert list(AnimeRoom.objects.dead()) == [dead]
    # 既定のマネージャは絞り込まない（管理画面と累計の統計が全行を見る）。
    assert AnimeRoom.objects.count() == 2


def test_queryset_delete_is_logical_and_reports_the_row_count():
    rooms = [AnimeRoomFactory(), AnimeRoomFactory()]
    untouched = AnimeRoomFactory()

    deleted = AnimeRoom.objects.filter(pk__in=[r.pk for r in rooms]).delete()

    assert deleted == 2
    assert AnimeRoom.objects.count() == 3
    assert list(AnimeRoom.objects.alive()) == [untouched]


def test_queryset_delete_hard_removes_the_rows():
    room = AnimeRoomFactory()
    untouched = AnimeRoomFactory()

    AnimeRoom.objects.filter(pk=room.pk).delete(hard=True)

    assert list(AnimeRoom.objects.all()) == [untouched]


def test_queryset_revive():
    room = AnimeRoomFactory()
    still_dead = AnimeRoomFactory()
    AnimeRoom.objects.all().delete()

    assert AnimeRoom.objects.filter(pk=room.pk).revive() == 1

    assert list(AnimeRoom.objects.alive()) == [room]
    assert list(AnimeRoom.objects.dead()) == [still_dead]
