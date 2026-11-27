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
