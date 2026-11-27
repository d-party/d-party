"""アナウンスのモデル（配信期間の絞り込み・状態・検証・DB 制約）のテスト。"""

import datetime

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from .factories import AnnouncementFactory
from .models import MESSAGE_MAX_LENGTH, Announcement, AnnouncementStatus

pytestmark = pytest.mark.django_db

NOW = datetime.datetime(2026, 11, 30, 12, 0, tzinfo=datetime.UTC)
HOUR = datetime.timedelta(hours=1)


def _make(starts: datetime.timedelta, ends: datetime.timedelta) -> Announcement:
    return AnnouncementFactory(starts_at=NOW + starts, ends_at=NOW + ends)


def test_live_includes_start_and_excludes_end():
    started_now = _make(datetime.timedelta(0), HOUR)
    running = _make(-HOUR, HOUR)
    _make(HOUR, 2 * HOUR)  # 予約
    _make(-2 * HOUR, datetime.timedelta(0))  # ちょうど期限 = 終了
    _make(-2 * HOUR, -HOUR)  # 終了

    live = Announcement.objects.live(NOW)

    assert set(live) == {started_now, running}


def test_scheduled_and_ended_split_the_rest():
    scheduled = _make(HOUR, 2 * HOUR)
    ended_at_now = _make(-2 * HOUR, datetime.timedelta(0))
    ended = _make(-2 * HOUR, -HOUR)
    _make(-HOUR, HOUR)

    assert set(Announcement.objects.scheduled(NOW)) == {scheduled}
    assert set(Announcement.objects.ended(NOW)) == {ended_at_now, ended}


def test_live_defaults_to_the_current_time():
    live = AnnouncementFactory()
    AnnouncementFactory(
        starts_at=timezone.now() + HOUR, ends_at=timezone.now() + 2 * HOUR
    )

    assert list(Announcement.objects.live()) == [live]


@pytest.mark.parametrize(
    ("starts", "ends", "status"),
    [
        (HOUR, 2 * HOUR, AnnouncementStatus.SCHEDULED),
        (datetime.timedelta(0), HOUR, AnnouncementStatus.LIVE),
        (-HOUR, datetime.timedelta(0), AnnouncementStatus.ENDED),
    ],
)
def test_status(starts, ends, status):
    assert _make(starts, ends).status(NOW) == status


def test_status_defaults_to_the_current_time():
    assert AnnouncementFactory().status() == AnnouncementStatus.LIVE


def test_message_is_limited():
    announcement = AnnouncementFactory.build(message="あ" * (MESSAGE_MAX_LENGTH + 1))

    with pytest.raises(ValidationError) as excinfo:
        announcement.full_clean()

    assert "message" in excinfo.value.message_dict


@pytest.mark.parametrize("ends", [datetime.timedelta(0), -HOUR])
def test_clean_rejects_end_not_after_start(ends):
    announcement = AnnouncementFactory.build(starts_at=NOW, ends_at=NOW + ends)

    with pytest.raises(ValidationError) as excinfo:
        announcement.full_clean()

    assert excinfo.value.message_dict["ends_at"] == [
        "配信期限は配信開始より後にしてください。"
    ]


def test_database_rejects_end_not_after_start():
    # 管理画面を通らない書き込み（update など）も DB の制約で止める。
    with pytest.raises(IntegrityError), transaction.atomic():
        Announcement.objects.create(message="x", starts_at=NOW, ends_at=NOW)


def test_str_is_the_message():
    assert str(AnnouncementFactory(message="お知らせ")) == "お知らせ"


# --- 配信対象の拡張機能のバージョン -------------------------------------------


def _targeting(lower: str | None, upper: str | None) -> Announcement:
    return AnnouncementFactory(min_extension_version=lower, max_extension_version=upper)


@pytest.mark.parametrize(
    ("version", "expected"),
    [
        ("2.14.9", False),  # 下限の手前
        ("2.15.0", True),  # 下限ちょうど
        ("2.15.7", True),
        ("2.16.3", True),  # 上限ちょうど
        ("2.16.4", False),  # 上限の先
        ("3.0.0", False),
    ],
)
def test_for_extension_version_includes_both_ends(version, expected):
    announcement = _targeting("2.15.0", "2.16.3")

    matched = Announcement.objects.for_extension_version(version)

    assert (announcement in matched) is expected


@pytest.mark.parametrize(
    ("lower", "upper", "version", "expected"),
    [
        ("2.15.0", None, "2.14.9", False),
        ("2.15.0", None, "2.15.0", True),
        ("2.15.0", None, "99.0.0", True),
        (None, "2.14.1", "0.0.0", True),
        (None, "2.14.1", "2.14.1", True),
        (None, "2.14.1", "2.14.2", False),
        (None, None, "0.0.0", True),
        (None, None, "65535.65535.65535", True),
    ],
)
def test_for_extension_version_with_open_ends(lower, upper, version, expected):
    announcement = _targeting(lower, upper)

    matched = Announcement.objects.for_extension_version(version)

    assert (announcement in matched) is expected


def test_for_extension_version_compares_numerically():
    # 文字列で比べると "2.10.0" < "2.9.0" になり、どちらも逆に当たってしまう。
    from_2_10 = _targeting("2.10.0", None)
    up_to_2_9 = _targeting(None, "2.9.0")

    assert list(Announcement.objects.for_extension_version("2.9.0")) == [up_to_2_9]
    assert list(Announcement.objects.for_extension_version("2.10.0")) == [from_2_10]


def test_version_bounds_are_read_back_as_text():
    announcement = _targeting("2.10.0", "10.0.3")
    announcement.refresh_from_db()

    assert announcement.min_extension_version == "2.10.0"
    assert announcement.max_extension_version == "10.0.3"


def test_rows_without_bounds_have_no_version_limit():
    announcement = AnnouncementFactory()
    announcement.refresh_from_db()

    assert announcement.min_extension_version is None
    assert announcement.max_extension_version is None
    assert announcement in Announcement.objects.for_extension_version("0.0.0")


@pytest.mark.parametrize(
    ("lower", "upper", "expected"),
    [
        ("2.15.0", "2.16.3", "2.15.0 〜 2.16.3"),
        (None, "2.14.1", "〜 2.14.1"),
        ("2.15.0", None, "2.15.0 〜"),
        (None, None, "すべて"),
    ],
)
def test_target_versions(lower, upper, expected):
    assert _targeting(lower, upper).target_versions() == expected


@pytest.mark.parametrize("upper", ["2.15.0", "2.15.1", "3.0.0", None])
def test_clean_accepts_upper_not_below_lower(upper):
    AnnouncementFactory.build(
        min_extension_version="2.15.0", max_extension_version=upper
    ).full_clean()


def test_clean_rejects_upper_below_lower():
    # 文字列で比べると "2.9.0" > "2.10.0" になり、見逃してしまう。
    announcement = AnnouncementFactory.build(
        min_extension_version="2.10.0", max_extension_version="2.9.0"
    )

    with pytest.raises(ValidationError) as excinfo:
        announcement.full_clean()

    assert excinfo.value.message_dict == {
        "max_extension_version": ["対象バージョンの上限は下限以上にしてください。"]
    }


def test_clean_reports_only_the_malformed_bound():
    announcement = AnnouncementFactory.build(
        min_extension_version="2.15", max_extension_version="2.0.0"
    )

    with pytest.raises(ValidationError) as excinfo:
        announcement.full_clean()

    assert set(excinfo.value.message_dict) == {"min_extension_version"}


def test_database_rejects_upper_below_lower():
    # 管理画面を通らない書き込み（update など）も DB の制約で止める。
    announcement = _targeting("2.10.0", "2.10.0")

    with pytest.raises(IntegrityError), transaction.atomic():
        Announcement.objects.filter(pk=announcement.pk).update(
            max_extension_version="2.9.0"
        )
