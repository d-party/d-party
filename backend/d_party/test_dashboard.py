"""管理画面トップ（``dashboard.py``）のテスト。"""

import datetime

import pytest
from django.contrib.auth.models import User
from django.urls import reverse
from django.utils import timezone

from d_party.dashboard import (
    _reaction_breakdown,
    dashboard_callback,
    environment_callback,
)
from streamer.factories import (
    AnimeRoomFactory,
    AnimeUserFactory,
    DmmRoomFactory,
    DmmUserFactory,
)
from streamer.models import AnimeReaction, AnimeRoom, ReactionStat


@pytest.mark.parametrize(
    ("debug", "badge"),
    [(True, ["Development", "warning"]), (False, ["Production", "danger"])],
)
def test_environment_badge(settings, debug, badge):
    settings.DEBUG = debug

    assert environment_callback(None) == badge


@pytest.mark.django_db
def test_reaction_breakdown_is_empty_without_reactions():
    breakdown, total = _reaction_breakdown()

    assert total == 0
    assert {row["label"] for row in breakdown} == {
        "cry",
        "middle_finger",
        "smile",
        "thumbs_up",
        "favorite",
    }
    assert all(row["count"] == 0 and row["percent"] == 0 for row in breakdown)


@pytest.mark.django_db
def test_reaction_breakdown_merges_folded_and_live_reactions():
    today = timezone.localdate()
    ReactionStat.objects.create(date=today, reaction_type="S", count=5)
    ReactionStat.objects.create(
        date=today - datetime.timedelta(days=1), reaction_type="S", count=1
    )
    ReactionStat.objects.create(date=today, reaction_type="C", count=1)
    live_room = AnimeRoomFactory()
    AnimeReaction.objects.create(room_id=live_room, reaction_type="S")
    AnimeReaction.objects.create(room_id=live_room, reaction_type="TU")
    # 終了したルームの生データは数えない（統計 API と同じ条件）。
    closed_room = AnimeRoomFactory()
    AnimeReaction.objects.create(room_id=closed_room, reaction_type="F")
    closed_room.delete()

    breakdown, total = _reaction_breakdown()

    assert total == 9
    assert breakdown[0] == {"label": "smile", "count": 7, "percent": 78}
    counts = {row["label"]: row["count"] for row in breakdown}
    assert counts == {
        "smile": 7,
        "cry": 1,
        "thumbs_up": 1,
        "favorite": 0,
        "middle_finger": 0,
    }
    assert [row["count"] for row in breakdown] == sorted(counts.values(), reverse=True)


@pytest.mark.django_db
def test_dashboard_cards_count_alive_rooms_and_users():
    room = AnimeRoomFactory()
    AnimeUserFactory(room_id=room)
    AnimeUserFactory(room_id=room).delete()
    AnimeRoomFactory().delete()
    yesterday = AnimeRoomFactory()
    AnimeRoom.objects.filter(pk=yesterday.pk).update(
        created_at=timezone.now() - datetime.timedelta(days=1)
    )
    ReactionStat.objects.create(
        date=timezone.localdate(), reaction_type="S", count=1234
    )

    context = dashboard_callback(None, {"existing": 1})

    assert context["existing"] == 1
    values = {card["title"]: card["value"] for card in context["dp_cards"]}
    assert values == {
        "アクティブなルーム": 2,
        "接続中ユーザー": 1,
        # 論理削除済みを含み、昨日のルームは含まない。
        "本日作成ルーム": 2,
        "累計リアクション": "1,234",
    }
    assert context["dp_reaction_breakdown"][0]["label"] == "smile"


@pytest.mark.django_db
def test_dashboard_cards_count_every_service_with_a_breakdown():
    AnimeUserFactory()
    dmm_room = DmmRoomFactory()
    DmmUserFactory(room_id=dmm_room)
    DmmUserFactory(room_id=dmm_room)
    DmmUserFactory(room_id=dmm_room).delete()
    DmmRoomFactory().delete()

    context = dashboard_callback(None, {})

    cards = {card["title"]: card for card in context["dp_cards"]}
    assert cards["アクティブなルーム"]["value"] == 2
    assert cards["アクティブなルーム"]["description"] == (
        "現在 alive な視聴ルーム（dアニメストア 1 · DMM TV 1）"
    )
    assert cards["接続中ユーザー"]["value"] == 3
    assert cards["接続中ユーザー"]["description"] == (
        "現在 alive な参加ユーザー（dアニメストア 1 · DMM TV 2）"
    )
    assert cards["本日作成ルーム"]["value"] == 3
    assert cards["本日作成ルーム"]["description"] == (
        "論理削除済みを含む本日の作成数（dアニメストア 1 · DMM TV 2）"
    )


@pytest.mark.django_db
def test_admin_index_renders_the_dashboard(client):
    client.force_login(User.objects.create_superuser(username="root"))
    AnimeRoomFactory()

    response = client.get(reverse("admin:index"))

    assert response.status_code == 200
    content = response.content.decode()
    assert "アクティブなルーム" in content
    assert "累計リアクション" in content
