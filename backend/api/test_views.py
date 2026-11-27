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
    "hourly-average-user",
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


class TestHourlyAverageUser:
    """入室時刻だけで時間帯ごとの 1 日あたり平均を出す。"""

    @pytest.fixture
    def now(self, monkeypatch):
        # 「今」を TIME_ZONE の 14:30 に固定する（localtime / localdate も now() から作られる）。
        fixed = datetime.datetime(
            2026, 11, 27, 14, 30, tzinfo=timezone.get_current_timezone()
        )
        monkeypatch.setattr(timezone, "now", lambda: fixed)
        return fixed

    @staticmethod
    def _enter_at(now, days_ago: int, hour: int, minute: int = 0) -> None:
        user = AnimeUserFactory()
        entered = now.replace(hour=hour, minute=minute) - datetime.timedelta(
            days=days_ago
        )
        AnimeUser.objects.filter(pk=user.pk).update(created_at=entered)

    def test_counts_entries_per_hour_over_the_days_each_hour_occurred(
        self, client, now
    ):
        for days_ago, hour, minute in [
            (2, 10, 15),
            (2, 10, 45),
            (1, 10, 5),
            (1, 23, 30),
            (0, 9, 0),
            (0, 14, 10),
        ]:
            self._enter_at(now, days_ago, hour, minute)
        # 退室しても入室時刻で数える。
        AnimeUser.objects.filter(created_at__hour=23).first().delete()

        data = client.get(STATS + "hourly-average-user", {"days": 7}).json()["data"]
        averages = {row["hour"]: row["average"] for row in data}

        # 最初の入室が 2 日前なので 3 日間。15 時以降は今日がまだ来ていないので 2 日間。
        assert [row["hour"] for row in data] == list(range(24))
        assert averages[10] == 1.0
        assert averages[9] == 0.33
        assert averages[14] == 0.33
        assert averages[23] == 0.5
        assert averages[0] == 0.0

    def test_days_limits_the_window_and_its_length(self, client, now):
        self._enter_at(now, 9, 20)
        self._enter_at(now, 0, 8)

        week = client.get(STATS + "hourly-average-user", {"days": 7}).json()["data"]
        month = client.get(STATS + "hourly-average-user", {"days": 30}).json()["data"]

        # 7 日だと今日だけ（1 日）、30 日だと 9 日前から（20 時台は今日を除く 9 日）。
        assert (week[8]["average"], week[20]["average"]) == (1.0, 0.0)
        assert (month[8]["average"], month[20]["average"]) == (0.1, 0.11)

    def test_empty_database_returns_zero_for_every_hour(self, client, now):
        data = client.get(STATS + "hourly-average-user").json()["data"]

        assert data == [{"hour": hour, "average": 0.0} for hour in range(24)]


@pytest.mark.parametrize(
    ("version", "is_possible"),
    [("1.10.0", True), ("1.9.0", True), ("2.0.0", True), ("1.8.99", False)],
)
def test_version_check_compares_numerically(client, settings, version, is_possible):
    """文字列として比べると ``1.10.0`` < ``1.9.0`` になる。"""
    settings.CHROME_EXTENSION_REQUIRED_VERSION = "1.9.0"

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


def test_browser_request_gets_json_not_the_browsable_api(client):
    # ブラウザの Accept（text/html 優先）でも、DRF の Browsable API は返さない。
    response = client.get(
        STATS + "anime-room-alive-count",
        HTTP_ACCEPT="text/html,application/xhtml+xml,*/*;q=0.8",
    )

    assert response.status_code == 200
    assert response["Content-Type"] == "application/json"


def test_format_suffix_cannot_select_the_browsable_api(client):
    assert client.get(STATS + "anime-room-alive-count?format=api").status_code == 404
