"""公開 API ``GET /api/v1/announcements`` のテスト。

``?extension_version=x.y.z`` で配信対象のものに絞り込める（省略時は絞り込まない）。
読み取り専用で認証は要らない。書き込みの口は持たないので、匿名でもログイン済みでも
GET 以外は 405 になる（作成・編集は管理画面だけ）。
"""

import datetime

import pytest
from django.contrib.auth.models import User
from django.utils import timezone

from .factories import AnnouncementFactory
from .models import Announcement, AnnouncementLevel
from .test_versions import INVALID_VERSIONS

pytestmark = pytest.mark.django_db

URL = "/api/v1/announcements"
HOUR = datetime.timedelta(hours=1)


def test_returns_only_live_announcements(client):
    now = timezone.now()
    live = AnnouncementFactory(message="配信中")
    AnnouncementFactory(message="予約", starts_at=now + HOUR, ends_at=now + 2 * HOUR)
    AnnouncementFactory(message="終了", starts_at=now - 2 * HOUR, ends_at=now - HOUR)

    response = client.get(URL)

    assert response.status_code == 200
    assert response.json() == {
        "data": [
            {
                "id": live.pk,
                "message": "配信中",
                "level": "info",
                "starts_at": timezone.localtime(live.starts_at).isoformat(),
                "ends_at": timezone.localtime(live.ends_at).isoformat(),
            }
        ]
    }


def test_orders_newest_start_first_regardless_of_level(client):
    now = timezone.now()
    old_info = AnnouncementFactory(starts_at=now - 3 * HOUR, ends_at=now + HOUR)
    new_info = AnnouncementFactory(starts_at=now - HOUR, ends_at=now + HOUR)
    old_warning = AnnouncementFactory(
        level=AnnouncementLevel.WARNING, starts_at=now - 2 * HOUR, ends_at=now + HOUR
    )

    data = client.get(URL).json()["data"]

    assert [row["id"] for row in data] == [new_info.pk, old_warning.pk, old_info.pk]


def test_same_start_puts_the_later_one_first(client):
    starts = timezone.now() - HOUR
    first = AnnouncementFactory(starts_at=starts)
    second = AnnouncementFactory(starts_at=starts)

    data = client.get(URL).json()["data"]

    assert [row["id"] for row in data] == [second.pk, first.pk]


def test_empty_when_nothing_is_live(client):
    assert client.get(URL).json() == {"data": []}


def test_is_cacheable_for_a_short_time(client):
    response = client.get(URL)

    assert response["Cache-Control"] == "public, max-age=60"


def _ids(response) -> set[int]:
    assert response.status_code == 200
    return {row["id"] for row in response.json()["data"]}


@pytest.mark.parametrize(
    ("version", "expected"),
    [
        ("2.14.9", {"open"}),
        ("2.15.0", {"open", "range"}),  # 下限ちょうど
        ("2.16.3", {"open", "range"}),  # 上限ちょうど
        ("2.16.4", {"open"}),
    ],
)
def test_filters_by_extension_version(client, version, expected):
    rows = {
        "open": AnnouncementFactory(),
        "range": AnnouncementFactory(
            min_extension_version="2.15.0", max_extension_version="2.16.3"
        ),
    }

    response = client.get(URL, {"extension_version": version})

    assert _ids(response) == {rows[name].pk for name in expected}


@pytest.mark.parametrize(
    ("version", "expected"),
    [
        ("2.14.1", {"open", "upper_only"}),
        ("2.14.2", {"open"}),
        ("2.15.0", {"open", "lower_only"}),
    ],
)
def test_filters_with_one_side_only(client, version, expected):
    rows = {
        "open": AnnouncementFactory(),
        "lower_only": AnnouncementFactory(min_extension_version="2.15.0"),
        "upper_only": AnnouncementFactory(max_extension_version="2.14.1"),
    }

    response = client.get(URL, {"extension_version": version})

    assert _ids(response) == {rows[name].pk for name in expected}


def test_compares_versions_numerically(client):
    from_2_10 = AnnouncementFactory(min_extension_version="2.10.0")
    up_to_2_9 = AnnouncementFactory(max_extension_version="2.9.0")

    assert _ids(client.get(URL, {"extension_version": "2.9.0"})) == {up_to_2_9.pk}
    assert _ids(client.get(URL, {"extension_version": "2.10.0"})) == {from_2_10.pk}


def test_version_filter_keeps_only_live_rows_and_the_order(client):
    now = timezone.now()
    older = AnnouncementFactory(
        starts_at=now - 2 * HOUR, ends_at=now + HOUR, max_extension_version="3.0.0"
    )
    newer = AnnouncementFactory(
        starts_at=now - HOUR, ends_at=now + HOUR, min_extension_version="2.0.0"
    )
    AnnouncementFactory(starts_at=now + HOUR, ends_at=now + 2 * HOUR)  # 予約
    AnnouncementFactory(starts_at=now - 2 * HOUR, ends_at=now - HOUR)  # 終了

    data = client.get(URL, {"extension_version": "2.15.0"}).json()["data"]

    assert [row["id"] for row in data] == [newer.pk, older.pk]


def test_without_version_returns_every_live_row(client):
    # 省略時はバージョンで絞り込まない（コレクションの既定）。
    rows = [
        AnnouncementFactory(),
        AnnouncementFactory(min_extension_version="99.0.0"),
        AnnouncementFactory(max_extension_version="0.0.1"),
    ]

    assert _ids(client.get(URL)) == {row.pk for row in rows}


def test_response_shape_is_unchanged_by_the_version_filter(client):
    AnnouncementFactory(min_extension_version="2.0.0", max_extension_version="3.0.0")

    data = client.get(URL, {"extension_version": "2.15.0"}).json()["data"]

    assert set(data[0]) == {"id", "message", "level", "starts_at", "ends_at"}


@pytest.mark.parametrize("version", INVALID_VERSIONS)
def test_rejects_malformed_version(client, version):
    AnnouncementFactory()

    response = client.get(URL, {"extension_version": version})

    assert response.status_code == 400
    assert response.json() == {
        "message": "extension_version パラメータは x.y.z の形式（例: 2.15.0）で指定してください"
    }


def test_version_filtered_response_is_cacheable_too(client):
    response = client.get(URL, {"extension_version": "2.15.0"})

    assert response["Cache-Control"] == "public, max-age=60"


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_anonymous_cannot_write(client, method):
    response = getattr(client, method)(
        URL, {"message": "x"}, content_type="application/json"
    )

    assert response.status_code == 405
    assert not Announcement.objects.filter(message="x").exists()


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_even_admins_cannot_write_through_rest(client, method):
    client.force_login(User.objects.create_superuser(username="root"))
    live = AnnouncementFactory()

    response = getattr(client, method)(
        URL, {"message": "x"}, content_type="application/json"
    )

    assert response.status_code == 405
    assert Announcement.objects.filter(pk=live.pk).exists()
