"""公開 API ``GET /api/v1/announcements`` のテスト。

読み取り専用で認証は要らない。書き込みの口は持たないので、匿名でもログイン済みでも
GET 以外は 405 になる（作成・編集は管理画面だけ）。
"""

import datetime

import pytest
from django.contrib.auth.models import User
from django.utils import timezone

from .factories import AnnouncementFactory
from .models import Announcement, AnnouncementLevel

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


def test_orders_warning_first_then_newest(client):
    now = timezone.now()
    old_info = AnnouncementFactory(starts_at=now - 3 * HOUR, ends_at=now + HOUR)
    new_info = AnnouncementFactory(starts_at=now - HOUR, ends_at=now + HOUR)
    old_warning = AnnouncementFactory(
        level=AnnouncementLevel.WARNING, starts_at=now - 2 * HOUR, ends_at=now + HOUR
    )

    data = client.get(URL).json()["data"]

    assert [row["id"] for row in data] == [old_warning.pk, new_info.pk, old_info.pk]


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
