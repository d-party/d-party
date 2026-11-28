import datetime
import logging
import re
import urllib.parse
from collections import Counter

import redis
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.db.models import Count, Min
from django.db.models.functions import ExtractHour, TruncDate
from django.utils import timezone
from django.utils.cache import patch_cache_control
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from announcements import versions
from announcements.models import Announcement
from streamer.models import SERVICES, AnimeRoom, DmmRoom, ReactionType
from streamer.reactions import reaction_counts_by_type

from .serializers import (
    AnnouncementListResultSerializer,
    AnnouncementSerializer,
    ApiMessageSerializer,
    CountResultSerializer,
    HourlyAverageResultSerializer,
    LobbyRedirectSerializer,
    PerDayResultSerializer,
    ReactionTypeCountResultSerializer,
    ShieldsBadgeSerializer,
    VersionCheckResultSerializer,
)

logger = logging.getLogger(__name__)

# ヘルスチェックが Redis の応答を待つ上限（秒）。
HEALTH_CHECK_REDIS_TIMEOUT_SECONDS = 2

# 統計はサービス（dアニメストア / DMM TV）を横断した d-party 全体の利用状況を表す。各集計は
# 全サービスのモデルを合算する（サービスは ``streamer.models.SERVICES`` に足せば反映される）。
ROOM_MODELS = tuple(service.room for service in SERVICES)
USER_MODELS = tuple(service.user for service in SERVICES)

# A strict ``major.minor.patch`` triple.
_STRICT_VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")

# 配信中のアナウンスをブラウザ（拡張機能の fetch）に覚えさせる秒数。管理画面での
# 追加・終了が拡張機能に届くまでの遅れの上限になる。
ANNOUNCEMENTS_MAX_AGE = 60

# OpenAPI スキーマに載せる ``?extension_version=x.y.z`` の定義。
_EXTENSION_VERSION_PARAMETER = OpenApiParameter(
    name="extension_version",
    type={
        "type": "string",
        "pattern": versions.PATTERN,
        "maxLength": versions.MAX_LENGTH,
    },
    description=(
        "拡張機能のバージョン（x.y.z。各部は 0〜65535 の整数。例: 2.15.0）。"
        "指定すると、このバージョンが配信対象（下限 ≤ バージョン ≤ 上限。"
        "下限・上限が空の側は制限なし）のものだけを返す。"
        "省略すると、バージョンでは絞り込まない（対象バージョンに関係なく、配信中のものをすべて返す）。"
        "形式が不正なら 400。"
    ),
)

# ``?days=N`` の既定と上限は 1 年。
DEFAULT_STATS_DAYS = 365
MAX_STATS_DAYS = 365

# OpenAPI スキーマ（``backend/openapi.json``）に載せる ``?days=N`` の定義。
_DAYS_PARAMETER = OpenApiParameter(
    name="days",
    type={
        "type": "integer",
        "minimum": 1,
        "maximum": MAX_STATS_DAYS,
        "default": DEFAULT_STATS_DAYS,
    },
    description="集計する日数。",
)


def _stats_schema(operation_id: str, response, *, days: bool = True):
    """統計 API の ``get`` に付けるスキーマ。``operation_id`` が TypeScript の関数名になる。"""
    responses = {200: response}
    if days:
        responses[400] = ApiMessageSerializer
    return extend_schema(
        operation_id=operation_id,
        parameters=[_DAYS_PARAMETER] if days else [],
        responses=responses,
    )


def _parse_days(request) -> int | None:
    """Parse ``?days=N`` into ``1..MAX_STATS_DAYS``; ``None`` signals an invalid request."""
    raw = request.GET.get("days")
    if raw is None:
        return DEFAULT_STATS_DAYS
    try:
        days = int(raw)
    except ValueError:
        return None
    return days if 1 <= days <= MAX_STATS_DAYS else None


def _since(days: int) -> datetime.date:
    """Inclusive start date of a ``days``-long window ending today.

    ``TruncDate`` と同じく settings の TIME_ZONE で日付を切る（``date.today()`` は使わない）。
    """
    return timezone.localdate() - datetime.timedelta(days=days - 1)


def _cached(key: str, producer):
    return cache.get_or_set(key, producer, settings.STATS_CACHE_SECONDS)


def _parse_strict_version(value: str | None) -> tuple[int, ...] | None:
    """Parse a strict ``x.y.z`` version into a comparable tuple, else ``None``."""
    if value is None or not _STRICT_VERSION_RE.match(value):
        return None
    return tuple(int(part) for part in value.split("."))


def _per_day_counts(model, since: datetime.date | None = None) -> list[dict]:
    """``[{"day": date, "count": n}, ...]``。作成日ごと、``since`` 以降（省略時は全期間）。"""
    rows = model.objects.all()
    if since is not None:
        rows = rows.filter(created_at__date__gte=since)
    return list(
        rows.annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(count=Count("created_at"))
        .order_by("day")
    )


def _resample_per_day(
    rows: list[dict], since: datetime.date | None = None
) -> list[dict]:
    """Fill gaps so every calendar day up to today has a count.

    The series starts at ``since`` when given, else at the first row.
    """
    today = timezone.localdate()
    counts = {row["day"]: row["count"] for row in rows}
    start = since or (rows[0]["day"] if rows else today)
    span = (max(today, start) - start).days
    return [
        {"day": day, "count": counts.get(day, 0)}
        for day in (start + datetime.timedelta(days=n) for n in range(span + 1))
    ]


def _mean_per_day(rows: list[dict]) -> float:
    """Mean of the daily counts over the window."""
    return sum(row["count"] for row in rows) / len(rows) if rows else 0.0


def _combined_per_day(models, since: datetime.date | None = None) -> list[dict]:
    """``_per_day_counts`` を複数のモデル（全サービス）で日ごとに合算する。"""
    merged: Counter[datetime.date] = Counter()
    for model in models:
        for row in _per_day_counts(model, since):
            merged[row["day"]] += row["count"]
    return [{"day": day, "count": merged[day]} for day in sorted(merged)]


def _sum_created(models, since: datetime.date) -> int:
    """``since`` 以降に作られた行数を全サービスで合算する。"""
    return sum(m.objects.filter(created_at__date__gte=since).count() for m in models)


def _sum_all(models) -> int:
    """論理削除済みも含む行数を全サービスで合算する。"""
    return sum(m.objects.count() for m in models)


def _sum_alive(models) -> int:
    """alive な行数を全サービスで合算する。"""
    return sum(m.objects.alive().count() for m in models)


def _hourly_average_entries(since: datetime.date) -> list[dict]:
    """``[{"hour": 0..23, "average": x}, ...]``。時間帯ごとの 1 日あたり平均入室数。

    入室時刻（参加ユーザーの ``created_at``。全サービスの合算）だけで数え、退室時刻は
    見ない。時刻は settings の TIME_ZONE で切る。分母はその時間帯が来た日数で、期間は
    ``since`` と最初の入室日の遅い方から今日まで。今日のまだ来ていない時間帯は分母に
    入れない。
    """
    counts: Counter[int] = Counter()
    firsts = []
    for model in USER_MODELS:
        rows = model.objects.filter(created_at__date__gte=since)
        first = rows.aggregate(first=Min("created_at"))["first"]
        if first is None:
            continue
        firsts.append(first)
        counts.update(
            dict(
                rows.annotate(hour=ExtractHour("created_at"))
                .values("hour")
                .annotate(count=Count("pk"))
                .values_list("hour", "count")
            )
        )
    if not firsts:
        return [{"hour": hour, "average": 0.0} for hour in range(24)]
    first = min(firsts)
    now = timezone.localtime()
    days = (now.date() - max(since, timezone.localdate(first))).days + 1

    def average(hour: int) -> float:
        occurrences = days - (hour > now.hour)
        return round(counts.get(hour, 0) / occurrences, 2) if occurrences else 0.0

    return [{"hour": hour, "average": average(hour)} for hour in range(24)]


def _mean_created_per_day(models) -> float:
    """全期間の 1 日あたりの平均作成数（全サービスの合算）。"""
    return _mean_per_day(_resample_per_day(_combined_per_day(models)))


def _database_ok() -> bool:
    """Whether PostgreSQL answers a trivial query."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        logger.warning("health check: database is unavailable", exc_info=True)
        return False
    return True


def _redis_ok() -> bool:
    """Whether the Redis behind the channel layer answers PING.

    Pings Redis directly instead of going through the channel layer or the
    cache, so the short timeouts apply and a hung Redis cannot stall the probe.
    """
    client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        socket_connect_timeout=HEALTH_CHECK_REDIS_TIMEOUT_SECONDS,
        socket_timeout=HEALTH_CHECK_REDIS_TIMEOUT_SECONDS,
    )
    try:
        return bool(client.ping())
    except Exception:
        logger.warning("health check: redis is unavailable", exc_info=True)
        return False
    finally:
        client.close()


class HealthCheckAPI(APIView):
    """Readiness of the whole service: Django, PostgreSQL and Redis.

    Returns 200 when rooms can be created, 503 otherwise. The extension disables
    the "create room" button on anything but 200. The body stays empty; which
    dependency failed is only logged.

    Not for container liveness probes: those must not depend on the database.
    """

    @extend_schema(operation_id="health", responses={200: None, 503: None})
    def get(self, request, format=None) -> Response:
        if _database_ok() and _redis_ok():
            return Response(status=status.HTTP_200_OK)
        return Response(status=status.HTTP_503_SERVICE_UNAVAILABLE)


class ChromeExtensionVersionCheckAPI(APIView):
    """Check whether a Chrome extension version is compatible with the backend."""

    @extend_schema(
        operation_id="versionCheck",
        parameters=[
            OpenApiParameter(
                name="extension-version",
                type=str,
                required=True,
                description="拡張機能のバージョン（x.y.z）。",
            )
        ],
        responses={
            200: VersionCheckResultSerializer,
            400: ApiMessageSerializer,
            406: ApiMessageSerializer,
        },
    )
    def get(self, request, format=None) -> Response:
        if "extension-version" not in request.GET:
            return Response(
                {"message": "extension-versionパラメータが存在しません"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_version = _parse_strict_version(request.GET["extension-version"])
        required_version = _parse_strict_version(
            settings.CHROME_EXTENSION_REQUIRED_VERSION
        )
        if current_version is None or required_version is None:
            return Response(
                {"message": "求めているバージョンの記法と一致しません"},
                status=status.HTTP_406_NOT_ACCEPTABLE,
            )

        return Response({"is_possible": current_version >= required_version})


class _StatsView(APIView):
    """``?days=N`` の期間で集計し、結果をキャッシュして ``{"data": ...}`` で返す。

    サブクラスは ``cache_key`` と ``produce`` を定義し、``get`` を ``_stats_schema`` 付きで
    宣言する（``operation_id`` を view ごとに変えるため）。
    """

    cache_key: str

    def produce(self, since: datetime.date):
        raise NotImplementedError

    def respond(self, request) -> Response:
        days = _parse_days(request)
        if days is None:
            return Response(
                {
                    "message": f"days パラメータは 1〜{MAX_STATS_DAYS} の整数で指定してください"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        since = _since(days)
        data = _cached(f"stats:{self.cache_key}:{days}", lambda: self.produce(since))
        return Response({"data": data})


class AnimeActiveUserPerDayAPI(_StatsView):
    """Daily count of users that have ever been in a room."""

    cache_key = "active-user-per-day"

    def produce(self, since):
        return _resample_per_day(_combined_per_day(USER_MODELS, since), since)

    @_stats_schema("statsActiveUserPerDay", PerDayResultSerializer)
    def get(self, request, format=None) -> Response:
        return self.respond(request)


class AnimeActiveRoomPerDayAPI(_StatsView):
    """Daily count of rooms created by users."""

    cache_key = "active-room-per-day"

    def produce(self, since):
        return _resample_per_day(_combined_per_day(ROOM_MODELS, since), since)

    @_stats_schema("statsActiveRoomPerDay", PerDayResultSerializer)
    def get(self, request, format=None) -> Response:
        return self.respond(request)


class AnimeHourlyAverageUserAPI(_StatsView):
    """Average users entering a room in each hour of the day (by entry time)."""

    cache_key = "hourly-average-user"

    def produce(self, since):
        return _hourly_average_entries(since)

    @_stats_schema("statsHourlyAverageUser", HourlyAverageResultSerializer)
    def get(self, request, format=None) -> Response:
        return self.respond(request)


class AnimeRoomReactionCountAPI(_StatsView):
    """Per-type reaction counts."""

    cache_key = "reaction-count"

    def produce(self, since):
        counts = reaction_counts_by_type(since)
        return [
            {"count": counts[value], "reaction_type": label}
            for value, label in ReactionType.choices
        ]

    @_stats_schema("statsReactionCount", ReactionTypeCountResultSerializer)
    def get(self, request, format=None) -> Response:
        return self.respond(request)


class AnimeRoomReactionAllCountAPI(_StatsView):
    """Total reaction count."""

    cache_key = "reaction-all-count"

    def produce(self, since):
        return {"count": reaction_counts_by_type(since).total()}

    @_stats_schema("statsReactionAllCount", CountResultSerializer)
    def get(self, request, format=None) -> Response:
        return self.respond(request)


class AnimeUserAllCountAPI(_StatsView):
    """User count within the requested period (by creation date)."""

    cache_key = "user-all-count"

    def produce(self, since):
        return {"count": _sum_created(USER_MODELS, since)}

    @_stats_schema("statsUserAllCount", CountResultSerializer)
    def get(self, request, format=None) -> Response:
        return self.respond(request)


class AnimeRoomAllCountAPI(_StatsView):
    """Room count within the requested period (by creation date)."""

    cache_key = "room-all-count"

    def produce(self, since):
        return {"count": _sum_created(ROOM_MODELS, since)}

    @_stats_schema("statsRoomAllCount", CountResultSerializer)
    def get(self, request, format=None) -> Response:
        return self.respond(request)


class AnimeUserAliveCountAPI(APIView):
    """Currently connected user count."""

    @_stats_schema("statsUserAliveCount", CountResultSerializer, days=False)
    def get(self, request, format=None) -> Response:
        return Response({"data": {"count": _sum_alive(USER_MODELS)}})


class AnimeRoomAliveCountAPI(APIView):
    """Currently active room count."""

    @_stats_schema("statsRoomAliveCount", CountResultSerializer, days=False)
    def get(self, request, format=None) -> Response:
        return Response({"data": {"count": _sum_alive(ROOM_MODELS)}})


class _ShieldsView(APIView):
    """Base view returning a shields.io endpoint badge payload (``schemaVersion`` 1)."""

    # docstring は OpenAPI の description になるので、実装の事情はコメントに書く。
    # README のバッジから認証なしで叩かれ、全期間を集計するので、統計 API と同じ秒数だけ
    # キャッシュする。

    def shields_data(self) -> dict:
        raise NotImplementedError

    @extend_schema(responses={200: ShieldsBadgeSerializer})
    def get(self, request, format=None) -> Response:
        data = _cached(f"shields:{type(self).__name__}", self.shields_data)
        return Response({"schemaVersion": 1, **data})


class RoomCountShieldsAPI(_ShieldsView):
    def shields_data(self) -> dict:
        return {"label": "TotalRoom", "message": str(_sum_all(ROOM_MODELS))}


class RoomCountParDayShieldsAPI(_ShieldsView):
    def shields_data(self) -> dict:
        return {
            "label": "Room",
            "message": f"{_mean_created_per_day(ROOM_MODELS):.2f}/day",
            "color": "brightgreen",
            "cacheSeconds": 86400,
        }


class UserCountShieldsAPI(_ShieldsView):
    def shields_data(self) -> dict:
        return {"label": "TotalUser", "message": str(_sum_all(USER_MODELS))}


class UserCountParDayShieldsAPI(_ShieldsView):
    def shields_data(self) -> dict:
        return {
            "label": "User",
            "message": f"{_mean_created_per_day(USER_MODELS):.2f}/day",
            "color": "brightgreen",
            "cacheSeconds": 86400,
        }


class ReactionCountShieldsAPI(_ShieldsView):
    def shields_data(self) -> dict:
        return {
            "label": "TotalReaction",
            "message": str(reaction_counts_by_type().total()),
        }


class AnimeStoreLobbyResolveAPI(APIView):
    """Resolve a room id to the dアニメストア redirect URL.

    Called by the frontend's lobby page (``/anime-store/lobby/<room_id>``).
    """

    @extend_schema(
        operation_id="lobbyResolve",
        responses={200: LobbyRedirectSerializer, 404: ApiMessageSerializer},
    )
    def get(self, request, room_id, format=None) -> Response:
        anime_room = AnimeRoom.objects.filter(room_id=room_id).first()
        if anime_room is None:
            return Response(
                {"message": "ルームが見つかりません"},
                status=status.HTTP_404_NOT_FOUND,
            )
        if anime_room.is_dead():
            return Response(
                {"message": "ルームは終了しています"},
                status=status.HTTP_404_NOT_FOUND,
            )

        query = urllib.parse.urlencode(
            {"partId": anime_room.part_id, "party": "join", "room_id": str(room_id)}
        )
        return Response(
            {
                "redirect_url": (
                    f"https://{settings.D_ANIME_STORE_DOMAIN}/animestore/sc_d_pc?{query}"
                ),
                "part_id": anime_room.part_id,
                "room_id": str(room_id),
                "title": anime_room.title,
            }
        )


class DmmTvLobbyResolveAPI(APIView):
    """Resolve a room id to the DMM TV redirect URL.

    ``AnimeStoreLobbyResolveAPI`` の DMM TV 版。フロントのルーム遷移ページ
    （``/dmm-tv/lobby/<room_id>``）が、拡張機能のインストール確認後にユーザーを
    どこへリダイレクトするか（＝再生ページ + party=join マーカー）を得るために呼ぶ。

    DMM の再生ページ URL は ``?season=..&content=..`` の両方で再生対象が決まるため、
    拡張機能は create 時に ``part_id`` へ ``season/content`` をまとめて格納する。ここでは
    それを分解して再生ページ（``/vod/playback/on-demand/``）の URL を復元する。スラッシュを
    含まない古い/最小データは content のみとして扱う。レスポンス契約（redirect_url /
    part_id / room_id / title）は anime 版と共通。
    """

    @extend_schema(
        operation_id="dmmLobbyResolve",
        responses={200: LobbyRedirectSerializer, 404: ApiMessageSerializer},
    )
    def get(self, request, room_id, format=None) -> Response:
        dmm_room = DmmRoom.objects.filter(room_id=room_id).first()
        if dmm_room is None:
            return Response(
                {"message": "ルームが見つかりません"},
                status=status.HTTP_404_NOT_FOUND,
            )
        if dmm_room.is_dead():
            return Response(
                {"message": "ルームは終了しています"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # part_id は "season/content"。スラッシュが無ければ content のみとして扱う。
        if "/" in dmm_room.part_id:
            season, content = dmm_room.part_id.split("/", 1)
        else:
            season, content = "", dmm_room.part_id

        base_url = f"https://{settings.DMM_TV_DOMAIN}/vod/playback/on-demand/?"
        params = {"content": content, "party": "join", "room_id": str(room_id)}
        if season:
            params["season"] = season
        url_param = urllib.parse.urlencode(params)
        return Response(
            {
                "redirect_url": base_url + url_param,
                "part_id": dmm_room.part_id,
                "room_id": str(room_id),
                "title": dmm_room.title,
            }
        )


class AnnouncementsActiveAPI(APIView):
    """Announcements being delivered now (``starts_at`` <= now < ``ends_at``).

    Read-only and public: the extension's popup and sidebar fetch it. Ordered by
    the newest start (regardless of the level). ``extension_version``
    narrows the collection to the announcements targeting that extension version.
    """

    # docstring は OpenAPI の description になるので、実装の事情はコメントに書く。
    # 書き込みの口は持たない（作成・編集は管理画面だけ）ので、GET 以外は 405 になる。
    # 拡張機能はポップアップやサイドバーを開くたびに叩くので、短い max-age を付ける。
    # キャッシュはクエリ文字列ごとに分かれるので、バージョンごとの応答が混ざることはない。

    @extend_schema(
        operation_id="announcementsActive",
        parameters=[_EXTENSION_VERSION_PARAMETER],
        responses={
            200: AnnouncementListResultSerializer,
            400: ApiMessageSerializer,
        },
    )
    def get(self, request, format=None) -> Response:
        rows = Announcement.objects.live()
        if "extension_version" in request.GET:
            version = request.GET["extension_version"]
            if versions.parse(version) is None:
                return Response(
                    {
                        "message": "extension_version パラメータは x.y.z の形式（例: 2.15.0）で指定してください"
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            rows = rows.for_extension_version(version)
        # 開始が同じものは後から登録したもの（id が大きい方）を先にして、並びを決める。
        rows = rows.order_by("-starts_at", "-id")
        response = Response({"data": AnnouncementSerializer(rows, many=True).data})
        patch_cache_control(response, public=True, max_age=ANNOUNCEMENTS_MAX_AGE)
        return response
