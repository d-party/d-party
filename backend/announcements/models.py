"""拡張機能に出す短いお知らせ（アナウンス）。

配信期間（``starts_at`` ≤ 現在 < ``ends_at``）の行だけを公開 API が返す。配信対象の
拡張機能のバージョン（下限 ≤ バージョン ≤ 上限。空の側は制限なし）でも絞り込める。
作成・編集は管理画面からだけ行う（REST の書き込み口は持たない）。
"""

from typing import ClassVar
lazy import datetime

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from . import versions
from .versions import ExtensionVersionField

# 本文の上限（文字数）。拡張機能のポップアップ（幅 360px）とサイドバー（幅 320px）に
# 2〜3 行で収まる長さ。
MESSAGE_MAX_LENGTH = 60

ENDS_BEFORE_STARTS = "配信期限は配信開始より後にしてください。"
MAX_VERSION_BELOW_MIN = "対象バージョンの上限は下限以上にしてください。"


class AnnouncementLevel(models.TextChoices):
    INFO = "info", "お知らせ"
    WARNING = "warning", "重要"


class AnnouncementStatus(models.TextChoices):
    """配信期間と現在時刻から決まる状態（列は持たない）。"""

    SCHEDULED = "scheduled", "予約"
    LIVE = "live", "配信中"
    ENDED = "ended", "終了"


class AnnouncementQuerySet(models.QuerySet):
    def live(self, now: datetime.datetime | None = None):
        """``starts_at`` ≤ ``now`` < ``ends_at`` の行。"""
        now = now or timezone.now()
        return self.filter(starts_at__lte=now, ends_at__gt=now)

    def scheduled(self, now: datetime.datetime | None = None):
        return self.filter(starts_at__gt=now or timezone.now())

    def ended(self, now: datetime.datetime | None = None):
        return self.filter(ends_at__lte=now or timezone.now())

    def for_extension_version(self, version: str):
        """``version``（``x.y.z``）が配信対象の行。下限・上限はどちらも含み、空の側は制限なし。

        比較は DB の整数（``versions.encode``）で行うので、``2.10.0`` > ``2.9.0`` になる。
        形の合わない ``version`` は ``ValueError``。
        """
        return self.filter(
            Q(min_extension_version__isnull=True)
            | Q(min_extension_version__lte=version),
            Q(max_extension_version__isnull=True)
            | Q(max_extension_version__gte=version),
        )


class Announcement(models.Model):
    message = models.CharField(
        "本文",
        max_length=MESSAGE_MAX_LENGTH,
        help_text=f"拡張機能に出す一言（{MESSAGE_MAX_LENGTH} 文字まで）。",
    )
    level = models.CharField(
        "種別",
        max_length=16,
        choices=AnnouncementLevel.choices,
        default=AnnouncementLevel.INFO,
        help_text="「重要」は拡張機能で目立つ色で出す（メンテナンスなど）。",
    )
    starts_at = models.DateTimeField("配信開始", default=timezone.now)
    ends_at = models.DateTimeField(
        "配信期限", help_text="この時刻になると配信を止める（この時刻は含まない）。"
    )
    min_extension_version = ExtensionVersionField(
        "対象バージョンの下限",
        null=True,
        blank=True,
        help_text=(
            "x.y.z の形（例: 2.15.0）。このバージョン以上の拡張機能に配信する"
            "（このバージョンも含む）。空なら下限なし。"
        ),
    )
    max_extension_version = ExtensionVersionField(
        "対象バージョンの上限",
        null=True,
        blank=True,
        help_text=(
            "x.y.z の形（例: 2.16.3）。このバージョン以下の拡張機能に配信する"
            "（このバージョンも含む）。空なら上限なし。"
        ),
    )
    created_at = models.DateTimeField("作成日時", auto_now_add=True)
    updated_at = models.DateTimeField("更新日時", auto_now=True)

    objects: ClassVar[AnnouncementQuerySet] = AnnouncementQuerySet.as_manager()  # type: ignore[assignment]

    class Meta:
        db_table = "announcements"
        verbose_name = "アナウンス"
        verbose_name_plural = "アナウンス"
        ordering = ("-starts_at",)
        constraints = [
            models.CheckConstraint(
                condition=Q(starts_at__lt=F("ends_at")),
                name="announcements_starts_before_ends",
                violation_error_message=ENDS_BEFORE_STARTS,
            ),
            models.CheckConstraint(
                condition=Q(min_extension_version__isnull=True)
                | Q(max_extension_version__isnull=True)
                | Q(min_extension_version__lte=F("max_extension_version")),
                name="announcements_min_version_lte_max",
                violation_error_message=MAX_VERSION_BELOW_MIN,
            ),
        ]

    def __str__(self) -> str:
        return self.message

    def clean(self) -> None:
        super().clean()
        if self.starts_at and self.ends_at and self.starts_at >= self.ends_at:
            raise ValidationError({"ends_at": ENDS_BEFORE_STARTS})
        # 形の合わない値は clean_fields がその項目のエラーにするので、ここでは比べない。
        lower = versions.parse(self.min_extension_version)
        upper = versions.parse(self.max_extension_version)
        if lower and upper and lower > upper:
            raise ValidationError({"max_extension_version": MAX_VERSION_BELOW_MIN})

    def target_versions(self) -> str:
        """配信対象のバージョンの範囲（例: ``2.15.0 〜 2.16.3``・``〜 2.14.1``・``すべて``）。"""
        lower, upper = self.min_extension_version, self.max_extension_version
        if lower is None and upper is None:
            return "すべて"
        return " ".join(part for part in (lower, "〜", upper) if part)

    def status(self, now: datetime.datetime | None = None) -> AnnouncementStatus:
        now = now or timezone.now()
        if now < self.starts_at:
            return AnnouncementStatus.SCHEDULED
        if now < self.ends_at:
            return AnnouncementStatus.LIVE
        return AnnouncementStatus.ENDED
