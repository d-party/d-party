import datetime
import re
import urllib.parse

from django.conf import settings
from django.core.cache import cache
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from streamer.models import AnimeRoom, AnimeUser, ReactionType
from streamer.reactions import reaction_counts_by_type

from .serializers import (
    ApiMessageSerializer,
    CountResultSerializer,
    LobbyRedirectSerializer,
    PerDayResultSerializer,
    ReactionTypeCountResultSerializer,
    ShieldsBadgeSerializer,
    VersionCheckResultSerializer,
)

# A strict ``major.minor.patch`` triple.
_STRICT_VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")

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


def _mean_per_day(model) -> float:
    """全期間の 1 日あたりの平均作成数。"""
    rows = _resample_per_day(_per_day_counts(model))
    return sum(row["count"] for row in rows) / len(rows) if rows else 0.0


class HealthCheckAPI(APIView):
    """Lightweight liveness probe. Returns 200 when the application is running."""

    @extend_schema(operation_id="health", responses={200: None})
    def get(self, request, format=None) -> Response:
        return Response(status=status.HTTP_200_OK)


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
        return _resample_per_day(_per_day_counts(AnimeUser, since), since)

    @_stats_schema("statsActiveUserPerDay", PerDayResultSerializer)
    def get(self, request, format=None) -> Response:
        return self.respond(request)


class AnimeActiveRoomPerDayAPI(_StatsView):
    """Daily count of rooms created by users."""

    cache_key = "active-room-per-day"

    def produce(self, since):
        return _resample_per_day(_per_day_counts(AnimeRoom, since), since)

    @_stats_schema("statsActiveRoomPerDay", PerDayResultSerializer)
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
        return {"count": AnimeUser.objects.filter(created_at__date__gte=since).count()}

    @_stats_schema("statsUserAllCount", CountResultSerializer)
    def get(self, request, format=None) -> Response:
        return self.respond(request)


class AnimeRoomAllCountAPI(_StatsView):
    """Room count within the requested period (by creation date)."""

    cache_key = "room-all-count"

    def produce(self, since):
        return {"count": AnimeRoom.objects.filter(created_at__date__gte=since).count()}

    @_stats_schema("statsRoomAllCount", CountResultSerializer)
    def get(self, request, format=None) -> Response:
        return self.respond(request)


class AnimeUserAliveCountAPI(APIView):
    """Currently connected user count."""

    @_stats_schema("statsUserAliveCount", CountResultSerializer, days=False)
    def get(self, request, format=None) -> Response:
        return Response({"data": {"count": AnimeUser.objects.alive().count()}})


class AnimeRoomAliveCountAPI(APIView):
    """Currently active room count."""

    @_stats_schema("statsRoomAliveCount", CountResultSerializer, days=False)
    def get(self, request, format=None) -> Response:
        return Response({"data": {"count": AnimeRoom.objects.alive().count()}})


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
        return {"label": "TotalRoom", "message": str(AnimeRoom.objects.count())}


class RoomCountParDayShieldsAPI(_ShieldsView):
    def shields_data(self) -> dict:
        return {
            "label": "Room",
            "message": f"{_mean_per_day(AnimeRoom):.2f}/day",
            "color": "brightgreen",
            "cacheSeconds": 86400,
        }


class UserCountShieldsAPI(_ShieldsView):
    def shields_data(self) -> dict:
        return {"label": "TotalUser", "message": str(AnimeUser.objects.count())}


class UserCountParDayShieldsAPI(_ShieldsView):
    def shields_data(self) -> dict:
        return {
            "label": "User",
            "message": f"{_mean_per_day(AnimeUser):.2f}/day",
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
