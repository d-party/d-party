"""アナウンスの管理画面（認証・権限・一覧の状態・検証・アクション）のテスト。

作成・編集・削除は管理画面だけで行う。未ログインはログイン画面へ送り返し、staff でない
アカウントも入れない。staff でもモデルの権限が無ければ 403 にする。
"""

import datetime

import pytest
from django.contrib.auth.models import Permission, User
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone

from .factories import AnnouncementFactory
from .models import Announcement
from .versions import INVALID_VERSION

pytestmark = pytest.mark.django_db

HOUR = datetime.timedelta(hours=1)
LOGIN = reverse("admin:login")


@pytest.fixture
def admin_client(client):
    client.force_login(User.objects.create_superuser(username="root"))
    return client


def _urls(pk: int) -> list[str]:
    return [
        reverse("admin:announcements_announcement_changelist"),
        reverse("admin:announcements_announcement_add"),
        reverse("admin:announcements_announcement_change", args=[pk]),
        reverse("admin:announcements_announcement_delete", args=[pk]),
    ]


def _form(**overrides) -> dict[str, str]:
    starts = timezone.localtime() - HOUR
    ends = starts + 2 * HOUR
    data = {
        "message": "新しいリアクションを追加しました",
        "level": "info",
        "starts_at_0": starts.strftime("%Y-%m-%d"),
        "starts_at_1": starts.strftime("%H:%M:%S"),
        "ends_at_0": ends.strftime("%Y-%m-%d"),
        "ends_at_1": ends.strftime("%H:%M:%S"),
    }
    data.update(overrides)
    return data


@pytest.mark.parametrize("index", range(4))
def test_anonymous_is_sent_to_login(client, index):
    url = _urls(AnnouncementFactory().pk)[index]

    response = client.get(url)

    assert response.status_code == 302
    assert response["Location"].startswith(LOGIN)


def test_anonymous_cannot_create(client):
    response = client.post(reverse("admin:announcements_announcement_add"), _form())

    assert response.status_code == 302
    assert response["Location"].startswith(LOGIN)
    assert not Announcement.objects.exists()


def test_anonymous_cannot_delete(client):
    announcement = AnnouncementFactory()

    client.post(
        reverse("admin:announcements_announcement_delete", args=[announcement.pk]),
        {"post": "yes"},
    )

    assert Announcement.objects.filter(pk=announcement.pk).exists()


def test_non_staff_user_is_sent_to_login(client):
    client.force_login(User.objects.create_user(username="viewer"))

    response = client.get(reverse("admin:announcements_announcement_changelist"))

    assert response.status_code == 302
    assert response["Location"].startswith(LOGIN)


def test_staff_without_permission_is_forbidden(client):
    client.force_login(User.objects.create_user(username="staff", is_staff=True))

    response = client.post(reverse("admin:announcements_announcement_add"), _form())

    assert response.status_code == 403
    assert not Announcement.objects.exists()


def test_staff_with_add_permission_can_create(client):
    client.force_login(_staff_with("add_announcement", "view_announcement"))

    response = client.post(reverse("admin:announcements_announcement_add"), _form())

    assert response.status_code == 302
    assert Announcement.objects.get().message == "新しいリアクションを追加しました"


@override_settings(TIME_ZONE="Asia/Tokyo")
def test_add_form_reads_times_in_the_site_time_zone(admin_client):
    # 管理画面の入力は TIME_ZONE（日本時間）として読み、UTC で保存する。
    admin_client.post(
        reverse("admin:announcements_announcement_add"),
        _form(
            starts_at_0="2026-12-03",
            starts_at_1="02:00:00",
            ends_at_0="2026-12-03",
            ends_at_1="06:00:00",
        ),
    )

    announcement = Announcement.objects.get()
    assert announcement.starts_at == datetime.datetime(
        2026, 12, 2, 17, 0, tzinfo=datetime.UTC
    )
    assert announcement.ends_at == datetime.datetime(
        2026, 12, 2, 21, 0, tzinfo=datetime.UTC
    )


def test_add_form_rejects_end_before_start(admin_client):
    starts = timezone.localtime()
    ends = starts - HOUR

    response = admin_client.post(
        reverse("admin:announcements_announcement_add"),
        _form(
            starts_at_0=starts.strftime("%Y-%m-%d"),
            starts_at_1=starts.strftime("%H:%M:%S"),
            ends_at_0=ends.strftime("%Y-%m-%d"),
            ends_at_1=ends.strftime("%H:%M:%S"),
        ),
    )

    assert response.status_code == 200
    assert response.context["adminform"].form.errors["ends_at"] == [
        "配信期限は配信開始より後にしてください。"
    ]
    assert not Announcement.objects.exists()


def test_add_form_rejects_long_message(admin_client):
    response = admin_client.post(
        reverse("admin:announcements_announcement_add"), _form(message="あ" * 61)
    )

    assert response.status_code == 200
    assert "message" in response.context["adminform"].form.errors


def test_add_form_saves_version_bounds(admin_client):
    admin_client.post(
        reverse("admin:announcements_announcement_add"),
        _form(min_extension_version="2.9.0", max_extension_version="2.10.0"),
    )

    announcement = Announcement.objects.get()
    assert announcement.min_extension_version == "2.9.0"
    assert announcement.max_extension_version == "2.10.0"


def test_add_form_leaves_empty_bounds_unlimited(admin_client):
    admin_client.post(
        reverse("admin:announcements_announcement_add"),
        _form(min_extension_version="", max_extension_version=""),
    )

    announcement = Announcement.objects.get()
    assert announcement.min_extension_version is None
    assert announcement.max_extension_version is None


@pytest.mark.parametrize(
    "version", ["2.1", "v2.1.0", "2.1.0-beta", "2.01.0", "65536.0.0", "1" * 17]
)
@pytest.mark.parametrize("field", ["min_extension_version", "max_extension_version"])
def test_add_form_rejects_malformed_version(admin_client, field, version):
    response = admin_client.post(
        reverse("admin:announcements_announcement_add"), _form(**{field: version})
    )

    assert response.status_code == 200
    assert response.context["adminform"].form.errors[field] == [INVALID_VERSION]
    assert not Announcement.objects.exists()


def test_add_form_rejects_too_long_version(admin_client):
    response = admin_client.post(
        reverse("admin:announcements_announcement_add"),
        _form(min_extension_version="1" * 1000),
    )

    assert response.status_code == 200
    assert "min_extension_version" in response.context["adminform"].form.errors
    assert not Announcement.objects.exists()


def test_add_form_rejects_upper_below_lower(admin_client):
    # 文字列で比べると "2.9.0" > "2.10.0" になり、見逃してしまう。
    response = admin_client.post(
        reverse("admin:announcements_announcement_add"),
        _form(min_extension_version="2.10.0", max_extension_version="2.9.0"),
    )

    assert response.status_code == 200
    assert response.context["adminform"].form.errors["max_extension_version"] == [
        "対象バージョンの上限は下限以上にしてください。"
    ]
    assert not Announcement.objects.exists()


def test_change_form_renders(admin_client):
    announcement = AnnouncementFactory()

    response = admin_client.get(
        reverse("admin:announcements_announcement_change", args=[announcement.pk])
    )

    assert response.status_code == 200


def test_changelist_shows_status(admin_client):
    now = timezone.now()
    AnnouncementFactory(message="配信中のもの")
    AnnouncementFactory(
        message="予約のもの", starts_at=now + HOUR, ends_at=now + 2 * HOUR
    )
    AnnouncementFactory(
        message="終了したもの",
        level="warning",
        starts_at=now - 2 * HOUR,
        ends_at=now - HOUR,
    )

    content = admin_client.get(
        reverse("admin:announcements_announcement_changelist")
    ).content.decode()

    for text in [
        "配信中のもの",
        "予約のもの",
        "終了したもの",
        "配信中",
        "予約",
        "終了",
    ]:
        assert text in content


def test_changelist_shows_target_versions(admin_client):
    AnnouncementFactory(min_extension_version="2.15.0", max_extension_version="2.16.3")
    AnnouncementFactory(max_extension_version="2.14.1")
    AnnouncementFactory()

    content = admin_client.get(
        reverse("admin:announcements_announcement_changelist")
    ).content.decode()

    for text in ["対象バージョン", "2.15.0 〜 2.16.3", "〜 2.14.1", "すべて"]:
        assert text in content


@pytest.mark.parametrize(
    ("status", "expected"),
    [("live", "配信中のもの"), ("scheduled", "予約のもの"), ("ended", "終了したもの")],
)
def test_changelist_filters_by_status(admin_client, status, expected):
    now = timezone.now()
    AnnouncementFactory(message="配信中のもの")
    AnnouncementFactory(
        message="予約のもの", starts_at=now + HOUR, ends_at=now + 2 * HOUR
    )
    AnnouncementFactory(
        message="終了したもの", starts_at=now - 2 * HOUR, ends_at=now - HOUR
    )

    response = admin_client.get(
        reverse("admin:announcements_announcement_changelist"), {"status": status}
    )

    assert [row.message for row in response.context["cl"].result_list] == [expected]


def test_end_now_stops_only_live_rows(admin_client):
    now = timezone.now()
    live = AnnouncementFactory()
    scheduled = AnnouncementFactory(starts_at=now + HOUR, ends_at=now + 2 * HOUR)

    admin_client.post(
        reverse("admin:announcements_announcement_changelist"),
        {"action": "end_now", "_selected_action": [live.pk, scheduled.pk]},
    )

    assert not Announcement.objects.live().exists()
    scheduled.refresh_from_db()
    assert scheduled.ends_at == now + 2 * HOUR


def _staff_with(*codenames: str) -> User:
    user = User.objects.create_user(username="staff", is_staff=True)
    user.user_permissions.set(Permission.objects.filter(codename__in=codenames))
    return user


def test_end_now_needs_change_permission(client):
    # 閲覧だけの staff は配信を止められない（一覧は見られる）。
    client.force_login(_staff_with("view_announcement"))
    live = AnnouncementFactory()
    ends_at = live.ends_at

    client.post(
        reverse("admin:announcements_announcement_changelist"),
        {"action": "end_now", "_selected_action": [live.pk]},
    )

    live.refresh_from_db()
    assert live.ends_at == ends_at


def test_end_now_with_change_permission(client):
    client.force_login(_staff_with("view_announcement", "change_announcement"))
    live = AnnouncementFactory()

    client.post(
        reverse("admin:announcements_announcement_changelist"),
        {"action": "end_now", "_selected_action": [live.pk]},
    )

    assert not Announcement.objects.live().exists()
