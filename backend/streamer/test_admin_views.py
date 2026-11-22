"""管理画面の一覧とアクションを、実際に描画・実行して確かめるテスト。"""

import pytest
from django.contrib.auth.models import User
from django.urls import reverse

from .factories import AnimeRoomFactory, AnimeUserFactory, SettingFactory
from .models import AnimeReaction, AnimeRoom

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_client(client):
    client.force_login(User.objects.create_superuser(username="root"))
    return client


@pytest.mark.parametrize(
    "url_name",
    [
        "admin:streamer_animeroom_changelist",
        "admin:streamer_animeuser_changelist",
        "admin:streamer_animereaction_changelist",
        "admin:streamer_setting_changelist",
        "admin:auth_user_changelist",
        "admin:auth_group_changelist",
    ],
)
def test_changelist_renders(admin_client, url_name):
    room = AnimeRoomFactory()
    AnimeUserFactory(room_id=room, is_host=True)
    AnimeReaction.objects.create(room_id=room, reaction_type="S")
    SettingFactory(room=room)

    response = admin_client.get(reverse(url_name))

    assert response.status_code == 200


def test_room_changelist_shows_closed_rooms_and_people_counts(admin_client):
    room = AnimeRoomFactory(title="生きているルーム")
    AnimeUserFactory(room_id=room)
    AnimeUserFactory(room_id=room).delete()
    closed = AnimeRoomFactory(title="終了したルーム")
    closed.delete()

    response = admin_client.get(reverse("admin:streamer_animeroom_changelist"))

    rows = {row.pk: row for row in response.context["cl"].result_list}
    assert set(rows) == {room.pk, closed.pk}
    assert (rows[room.pk].num_people, rows[room.pk].sum_people) == (1, 2)
    assert (rows[closed.pk].num_people, rows[closed.pk].sum_people) == (0, 0)
    content = response.content.decode()
    assert "生きているルーム" in content
    assert "終了したルーム" in content


def test_user_change_form_has_no_name_fields(admin_client):
    user = User.objects.get(username="root")

    response = admin_client.get(reverse("admin:auth_user_change", args=[user.pk]))

    assert response.status_code == 200
    fields = response.context["adminform"].form.fields
    assert "email" in fields
    assert "first_name" not in fields
    assert "last_name" not in fields


def _run_action(admin_client, action: str, rooms) -> None:
    response = admin_client.post(
        reverse("admin:streamer_animeroom_changelist"),
        {"action": action, "_selected_action": [str(room.pk) for room in rooms]},
    )
    assert response.status_code == 302


def test_logically_delete_action_closes_only_the_selected_rooms(admin_client):
    selected = AnimeRoomFactory()
    other = AnimeRoomFactory()

    _run_action(admin_client, "logically_delete", [selected])

    assert list(AnimeRoom.objects.alive()) == [other]
    assert AnimeRoom.objects.count() == 2


def test_revive_action_reopens_the_selected_rooms(admin_client):
    selected = AnimeRoomFactory()
    other = AnimeRoomFactory()
    AnimeRoom.objects.all().delete()

    _run_action(admin_client, "revive", [selected])

    assert list(AnimeRoom.objects.alive()) == [selected]
    assert list(AnimeRoom.objects.dead()) == [other]
