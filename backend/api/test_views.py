"""``tests.py`` が触れていない API の分岐（400 / 404 / shields / 日次の穴埋め）のテスト。"""

import datetime

import pytest
from django.utils import timezone

from api.views import _mean_per_day, _resample_per_day, _ShieldsView
from streamer.factories import AnimeRoomFactory, AnimeUserFactory
from streamer.models import AnimeRoom, AnimeUser

pytestmark = pytest.mark.django_db

STATS = "/api/v1/statistics/anime-store/"
DAYS_ENDPOINTS = [
    "active-user-per-day",
    "active-room-per-day",
    "anime-reaction-count",
    "anime-reaction-all-count",
    "anime-room-all-count",
    "anime-user-all-count",
]


def _backdate(model, instance, days: int) -> None:
    # auto_now_add は create 時に渡した値を無視する。
    model.objects.filter(pk=instance.pk).update(
        created_at=timezone.now() - datetime.timedelta(days=days)
    )


@pytest.mark.parametrize("endpoint", DAYS_ENDPOINTS)
@pytest.mark.parametrize("days", ["0", "366", "abc"])
def test_every_stats_endpoint_rejects_bad_days(client, endpoint, days):
    response = client.get(STATS + endpoint, {"days": days})

    assert response.status_code == 400
    assert response.json() == {
        "message": "days パラメータは 1〜365 の整数で指定してください"
    }


@pytest.mark.parametrize(
    "endpoint", ["anime-room-alive-count", "anime-user-alive-count"]
)
def test_alive_counts_ignore_closed_rows(client, endpoint):
    room = AnimeRoomFactory()
    AnimeUserFactory(room_id=room)
    closed = AnimeRoomFactory()
    AnimeUserFactory(room_id=closed).delete()
    closed.delete()

    response = client.get(STATS + endpoint)

    assert response.json() == {"data": {"count": 1}}


def test_room_all_count_respects_days(client):
    AnimeRoomFactory()
    _backdate(AnimeRoom, AnimeRoomFactory(), days=10)

    assert client.get(STATS + "anime-room-all-count", {"days": 7}).json() == {
        "data": {"count": 1}
    }
    assert client.get(STATS + "anime-room-all-count", {"days": 30}).json() == {
        "data": {"count": 2}
    }


def test_per_day_series_covers_every_day_of_the_window(client):
    today = timezone.localdate()
    AnimeRoomFactory()
    AnimeRoomFactory()
    _backdate(AnimeRoom, AnimeRoomFactory(), days=2)

    data = client.get(STATS + "active-room-per-day", {"days": 4}).json()["data"]

    assert data == [
        {"day": str(today - datetime.timedelta(days=3)), "count": 0},
        {"day": str(today - datetime.timedelta(days=2)), "count": 1},
        {"day": str(today - datetime.timedelta(days=1)), "count": 0},
        {"day": str(today), "count": 2},
    ]


@pytest.mark.parametrize(
    ("version", "is_possible"),
    [("1.10.0", True), ("1.9.0", True), ("2.0.0", True), ("1.8.99", False)],
)
def test_version_check_compares_numerically(client, monkeypatch, version, is_possible):
    """文字列として比べると ``1.10.0`` < ``1.9.0`` になる。"""
    monkeypatch.setenv("CHROME_EXTENSION_REQUIRED_VERSION", "1.9.0")

    response = client.get(
        "/api/v1/chrome-extension/version-check", {"extension-version": version}
    )

    assert response.json() == {"is_possible": is_possible}


def test_lobby_resolve_closed_room_404(client):
    room = AnimeRoomFactory()
    room.delete()

    response = client.get(f"/api/v1/anime-store/lobby/{room.room_id}")

    assert response.status_code == 404
    assert response.json() == {"message": "ルームは終了しています"}


def test_lobby_resolve_rejects_malformed_room_id(client):
    assert client.get("/api/v1/anime-store/lobby/not-a-uuid").status_code == 404


class TestShields:
    def test_empty_database(self, client):
        assert client.get("/api/shields/total-room").json() == {
            "schemaVersion": 1,
            "label": "TotalRoom",
            "message": "0",
        }
        assert client.get("/api/shields/total-user").json()["message"] == "0"
        assert client.get("/api/shields/total-reaction").json()["message"] == "0"
        assert client.get("/api/shields/room-par-day").json() == {
            "schemaVersion": 1,
            "label": "Room",
            "message": "0.00/day",
            "color": "brightgreen",
            "cacheSeconds": 86400,
        }
        assert client.get("/api/shields/user-par-day").json()["message"] == "0.00/day"

    def test_totals_include_closed_rows(self, client):
        room = AnimeRoomFactory()
        AnimeUserFactory(room_id=room)
        AnimeUserFactory(room_id=room).delete()
        AnimeRoomFactory().delete()

        assert client.get("/api/shields/total-room").json()["message"] == "2"
        assert client.get("/api/shields/total-user").json()["message"] == "2"

    def test_per_day_mean_runs_from_the_first_row_to_today(self, client):
        room = AnimeRoomFactory()
        _backdate(AnimeRoom, room, days=3)
        for _ in range(2):
            AnimeRoomFactory()
        user = AnimeUserFactory(room_id=room)
        _backdate(AnimeUser, user, days=1)

        # ルームは 4 日間で 3 件、ユーザーは 2 日間で 1 件。
        assert client.get("/api/shields/room-par-day").json()["message"] == "0.75/day"
        assert client.get("/api/shields/user-par-day").json()["message"] == "0.50/day"

    def test_base_view_requires_shields_data(self):
        with pytest.raises(NotImplementedError):
            _ShieldsView().shields_data()


class TestResamplePerDay:
    def test_without_rows_or_since_returns_today_only(self):
        assert _resample_per_day([]) == [{"day": timezone.localdate(), "count": 0}]

    def test_since_in_the_future_returns_that_day_only(self):
        tomorrow = timezone.localdate() + datetime.timedelta(days=1)

        assert _resample_per_day([], tomorrow) == [{"day": tomorrow, "count": 0}]

    def test_mean_of_no_rows_is_zero(self):
        assert _mean_per_day([]) == 0.0
