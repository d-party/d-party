from django.contrib import admin, messages
from django.utils import timezone
from unfold.admin import ModelAdmin
from unfold.decorators import action, display

from .models import Announcement, AnnouncementStatus


class StatusFilter(admin.SimpleListFilter):
    """配信期間と現在時刻から決まる状態で絞り込む（列は持たない）。"""

    title = "状態"
    parameter_name = "status"

    def lookups(self, request, model_admin):
        return AnnouncementStatus.choices

    def queryset(self, request, queryset):
        match self.value():
            case AnnouncementStatus.LIVE:
                return queryset.live()
            case AnnouncementStatus.SCHEDULED:
                return queryset.scheduled()
            case AnnouncementStatus.ENDED:
                return queryset.ended()
        return queryset


@admin.register(Announcement)
class AnnouncementAdmin(ModelAdmin):
    list_display = (
        "message",
        "status_label",
        "level_label",
        "starts_at",
        "ends_at",
        "updated_at",
    )
    list_filter = (StatusFilter, "level")
    search_fields = ("message",)
    fields = ("message", "level", "starts_at", "ends_at", "created_at", "updated_at")
    readonly_fields = ("created_at", "updated_at")
    actions = ["end_now"]

    @display(
        description="状態",
        label={
            AnnouncementStatus.LIVE: "success",
            AnnouncementStatus.SCHEDULED: "info",
            AnnouncementStatus.ENDED: "default",
        },
    )
    def status_label(self, obj: Announcement):
        status = obj.status()
        return status.value, status.label

    @display(description="種別", label={"info": "primary", "warning": "warning"})
    def level_label(self, obj: Announcement):
        return obj.level, obj.get_level_display()

    @action(description="選択したアナウンスの配信を今すぐ終了", permissions=["change"])
    def end_now(self, request, queryset):
        # 期限を今にする。予約中（と開始ちょうど）の行は開始 < 期限の制約を満たせないので、
        # 配信中のものだけ止める。
        now = timezone.now()
        ended = queryset.filter(starts_at__lt=now, ends_at__gt=now).update(
            ends_at=now, updated_at=now
        )
        self.message_user(
            request, f"{ended} 件の配信を終了しました。", messages.SUCCESS
        )
