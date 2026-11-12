import datetime
import os
from unittest import mock

import pytest
import redis
from django.db import OperationalError
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from api import serializers, views
from streamer.factories import AnimeRoomFactory, AnimeUserFactory
from streamer.models import AnimeReaction, ReactionStat


def _clear_reaction_tables() -> None:
    """Drop reaction rows so reaction-count assertions are deterministic.

    The test DB uses a ``MIRROR`` config, so rows committed by ``transaction=True``
    tests (e.g. the consumer folding test) are not flushed between runs. Called in
    ``setUp`` it runs inside the per-test transaction and is rolled back afterwards,
    so it only hides that committed pollution for the duration of one test.
    """
    ReactionStat.objects.all().delete()
    AnimeReaction.objects.all().delete(hard=True)


class TestHealthCheckAPI(APITestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.endpoint = "/api/v1/health"

    @pytest.mark.django_db
    def test_health_check_ok_200(self):
        # pytest は Redis なしで走らせるので、Redis の確認だけ差し替える。
        with mock.patch("api.views._redis_ok", return_value=True):
            response = self.client.get(self.endpoint)
        assert response.status_code == status.HTTP_200_OK
        assert response.content == b""

    @pytest.mark.django_db
    def test_health_check_database_down_503(self):
        with mock.patch("api.views._database_ok", return_value=False):
            response = self.client.get(self.endpoint)
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.content == b""

    @pytest.mark.django_db
    def test_health_check_redis_down_503(self):
        with mock.patch("api.views._redis_ok", return_value=False):
            response = self.client.get(self.endpoint)
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.content == b""

    def test_database_ok_false_when_query_fails(self):
        with mock.patch("api.views.connection.cursor", side_effect=OperationalError):
            assert views._database_ok() is False

    def test_redis_ok_false_when_ping_fails(self):
        with mock.patch(
            "api.views.redis.Redis.ping", side_effect=redis.ConnectionError
        ):
            assert views._redis_ok() is False


class TestVersionCheckAPI(APITestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.endpoint = "/api/v1/chrome-extension/version-check"

    @pytest.mark.django_db
    def test_version_check_possible_ok_200(self):
        get_params = {"extension-version": "1000.0.0"}
        response = self.client.get(self.endpoint, get_params)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_possible"]
        assert type(response.data["is_possible"]) == bool

    @pytest.mark.django_db
    def test_version_check_possible_edgecase_ok_200(self):
        """最小バージョンと同じなら可。"""
        get_params = {
            "extension-version": str(os.getenv("CHROME_EXTENSION_REQUIRED_VERSION"))
        }
        response = self.client.get(self.endpoint, get_params)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["is_possible"]
        assert type(response.data["is_possible"]) == bool

    @pytest.mark.django_db
    def test_version_check_impossible_ok_200(self):
        get_params = {"extension-version": "0.0.0"}
        response = self.client.get(self.endpoint, get_params)
        assert response.status_code == status.HTTP_200_OK
        assert not response.data["is_possible"]
        assert type(response.data["is_possible"]) == bool

    @pytest.mark.django_db
    def test_version_check_ng_406(self):
        get_params = {"extension-version": "string"}
        response = self.client.get(self.endpoint, get_params)
        assert response.status_code == status.HTTP_406_NOT_ACCEPTABLE
        get_params = {"extension-version": 1000}
        response = self.client.get(self.endpoint, get_params)
        assert response.status_code == status.HTTP_406_NOT_ACCEPTABLE
        get_params = {"extension-version": "1000.0.0.0.0"}
        response = self.client.get(self.endpoint, get_params)
        assert response.status_code == status.HTTP_406_NOT_ACCEPTABLE

    @pytest.mark.django_db
    def test_version_check_ng_400(self):
        response = self.client.get(self.endpoint)
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        get_params = {"version": "1000.0.0"}
        response = self.client.get(self.endpoint, get_params)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestAnimeStoreLobbyResolveAPI(APITestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    def endpoint(self, room_id) -> str:
        return f"/api/v1/anime-store/lobby/{room_id}"

    @pytest.mark.django_db
    def test_lobby_resolve_ok_200(self):
        room = AnimeRoomFactory(part_id="654321", title="鬼滅の刃 - 第1話 - 残酷")
        response = self.client.get(self.endpoint(room.room_id))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["part_id"] == "654321"
        assert response.data["room_id"] == str(room.room_id)
        assert response.data["title"] == "鬼滅の刃 - 第1話 - 残酷"
        assert "partId=654321" in response.data["redirect_url"]

    @pytest.mark.django_db
    def test_lobby_resolve_not_found_404(self):
        import uuid

        response = self.client.get(self.endpoint(uuid.uuid4()))
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestStatsDaysParam(APITestCase):
    """``?days=N`` の検証（未指定→既定、範囲外→400）。"""

    def setUp(self) -> None:
        self.client = APIClient()
        self.endpoint = "/api/v1/statistics/anime-store/active-user-per-day"

    @pytest.mark.django_db
    def test_missing_days_defaults_ok_200(self):
        response = self.client.get(self.endpoint)
        assert response.status_code == status.HTTP_200_OK

    @pytest.mark.django_db
    def test_days_out_of_range_400(self):
        for bad in ("0", "366", "-1", "abc", "1.5"):
            response = self.client.get(self.endpoint, {"days": bad})
            assert response.status_code == status.HTTP_400_BAD_REQUEST, bad

    @pytest.mark.django_db
    def test_days_in_range_ok_200(self):
        for ok in ("1", "30", "365"):
            response = self.client.get(self.endpoint, {"days": ok})
            assert response.status_code == status.HTTP_200_OK, ok


class TestStatsPeriodScope(APITestCase):
    """期間スコープ（累計・リアクション）が days に従うことを確認。"""

    def setUp(self) -> None:
        self.client = APIClient()
        _clear_reaction_tables()

    @staticmethod
    def _make_reaction(room, reaction_type, when):
        reaction = AnimeReaction.objects.create(
            room_id=room, reaction_type=reaction_type
        )
        AnimeReaction.objects.filter(pk=reaction.pk).update(created_at=when)
        return reaction

    @pytest.mark.django_db
    def test_user_all_count_respects_days(self):
        """40 日前のユーザーは 30 日窓では数えず 365 日窓では数える。

        テスト DB は ``MIRROR`` 設定で他テストの行が残りうるため、絶対値ではなく
        「40 日前ユーザーを 1 人足すと 365 日窓だけ +1 される」差分で検証する。
        """
        from streamer.models import AnimeUser

        AnimeUserFactory()  # recent（auto_now_add で created_at=now）
        old = AnimeUserFactory()
        AnimeUser.objects.filter(pk=old.pk).update(
            created_at=timezone.now() - datetime.timedelta(days=40)
        )
        endpoint = "/api/v1/statistics/anime-store/anime-user-all-count"

        c30 = self.client.get(endpoint, {"days": "30"}).data["data"]["count"]
        c365 = self.client.get(endpoint, {"days": "365"}).data["data"]["count"]
        assert c30 >= 1  # recent は 30 日窓に入る
        assert c365 - c30 >= 1  # 40 日前ユーザーは 365 日窓のみに入る

    @pytest.mark.django_db
    def test_reaction_counts_come_from_reactionstat_and_live(self):
        """リアクション集計は ReactionStat（畳み込み済み）と alive ルームの合算。"""
        today = timezone.now().date()
        ReactionStat.objects.create(date=today, reaction_type="S", count=5)
        live_room = AnimeRoomFactory()  # alive
        self._make_reaction(live_room, "S", timezone.now())

        by_type = self.client.get(
            "/api/v1/statistics/anime-store/anime-reaction-count", {"days": "30"}
        )
        smile = next(r for r in by_type.data["data"] if r["reaction_type"] == "smile")
        assert smile["count"] == 6  # 5 (folded) + 1 (live)

        total = self.client.get(
            "/api/v1/statistics/anime-store/anime-reaction-all-count", {"days": "30"}
        )
        assert total.data["data"]["count"] == 6


class TestStatsCache(APITestCase):
    """キャッシュヒット時に DB の変化が TTL 内では反映されないこと。"""

    def setUp(self) -> None:
        self.client = APIClient()
        self.endpoint = "/api/v1/statistics/anime-store/anime-reaction-all-count"
        _clear_reaction_tables()

    @pytest.mark.django_db
    def test_response_is_cached(self):
        today = timezone.now().date()
        ReactionStat.objects.create(date=today, reaction_type="S", count=3)

        first = self.client.get(self.endpoint, {"days": "30"})
        assert first.data["data"]["count"] == 3

        ReactionStat.objects.filter(date=today, reaction_type="S").update(count=99)
        second = self.client.get(self.endpoint, {"days": "30"})
        assert second.data["data"]["count"] == 3  # キャッシュヒット


class TestReactionCountShieldsAPI(APITestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.endpoint = "/api/shields/total-reaction"
        _clear_reaction_tables()

    @pytest.mark.django_db
    def test_counts_folded_and_live_reactions(self):
        """畳み込み済み（ReactionStat）と生存ルームの未畳み込み分を合算する"""
        today = timezone.localdate()
        ReactionStat.objects.create(date=today, reaction_type="S", count=5)
        live_room = AnimeRoomFactory()
        AnimeReaction.objects.create(room_id=live_room, reaction_type="F")
        response = self.client.get(self.endpoint)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["schemaVersion"] == 1
        assert response.data["message"] == "6"


class TestResponsesMatchSchema(APITestCase):
    """実際のレスポンスが ``serializers.py`` の宣言（= OpenAPI スキーマ）と一致すること。

    view は serializer を通さずに dict を返すので、宣言だけがずれても気付けない。
    """

    def assert_matches(self, url: str, serializer_class) -> None:
        response = self.client.get(url)
        assert response.status_code == status.HTTP_200_OK, url
        body = response.json()
        serializer = serializer_class(data=body)
        assert serializer.is_valid(), (url, serializer.errors)
        # 宣言に無いキーを返していないこと（必須キーの欠落は is_valid が見る）。
        assert set(body) <= set(serializer.fields), url

    @pytest.mark.django_db
    def test_responses_match_schema(self):
        room = AnimeRoomFactory(part_id="654321", title="title")
        AnimeUserFactory(room_id=room)
        stats = "/api/v1/statistics/anime-store"
        cases = [
            (
                "/api/v1/chrome-extension/version-check?extension-version=1.0.0",
                serializers.VersionCheckResultSerializer,
            ),
            (
                f"/api/v1/anime-store/lobby/{room.room_id}",
                serializers.LobbyRedirectSerializer,
            ),
            (f"{stats}/active-user-per-day", serializers.PerDayResultSerializer),
            (f"{stats}/active-room-per-day", serializers.PerDayResultSerializer),
            (
                f"{stats}/anime-reaction-count",
                serializers.ReactionTypeCountResultSerializer,
            ),
            (f"{stats}/anime-reaction-all-count", serializers.CountResultSerializer),
            (f"{stats}/anime-room-all-count", serializers.CountResultSerializer),
            (f"{stats}/anime-user-all-count", serializers.CountResultSerializer),
            (f"{stats}/anime-room-alive-count", serializers.CountResultSerializer),
            (f"{stats}/anime-user-alive-count", serializers.CountResultSerializer),
            ("/api/shields/total-room", serializers.ShieldsBadgeSerializer),
            ("/api/shields/room-par-day", serializers.ShieldsBadgeSerializer),
            ("/api/shields/total-user", serializers.ShieldsBadgeSerializer),
            ("/api/shields/user-par-day", serializers.ShieldsBadgeSerializer),
            ("/api/shields/total-reaction", serializers.ShieldsBadgeSerializer),
        ]
        for url, serializer_class in cases:
            self.assert_matches(url, serializer_class)

    @pytest.mark.django_db
    def test_error_responses_match_schema(self):
        for url in [
            "/api/v1/chrome-extension/version-check",
            "/api/v1/statistics/anime-store/anime-user-all-count?days=0",
            "/api/v1/anime-store/lobby/00000000-0000-0000-0000-000000000000",
        ]:
            body = self.client.get(url).json()
            assert serializers.ApiMessageSerializer(data=body).is_valid(), url
