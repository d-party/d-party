from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group, User
from django.utils.timezone import now
from django.utils.translation import gettext_lazy as _
from unfold.admin import ModelAdmin
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

from .models import AnimeReaction, AnimeRoom, AnimeUser, Setting


@admin.action(description="Logically delete selected items")
def logically_delete(modeladmin, request, queryset):
    queryset.update(deleted_at=now())


@admin.action(description="Revive selected items")
def revive(modeladmin, request, queryset):
    queryset.update(deleted_at=None)


class LogicalDeletionModelAdmin(ModelAdmin):
    """Admin base for models using logical deletion (django-unfold themed)."""

    actions = [logically_delete, revive]
    readonly_fields = ("deleted_at",)
    ordering = ("-created_at",)

    def get_queryset(self, request):
        # Show every row (including logically deleted) in the admin.
        return self.model.objects.get_queryset()


@admin.register(AnimeRoom)
class AnimeRoomAdmin(LogicalDeletionModelAdmin):
    list_display = (
        "room_id",
        "title",
        "part_id",
        "num_people",
        "sum_people",
        "created_at",
        "deleted_at",
    )

    def get_queryset(self, request):
        # 行ごとに COUNT しないよう、まとめて注釈する。
        return super().get_queryset(request).with_people_counts()

    @admin.display(description=_("in room"), ordering="num_people")
    def num_people(self, obj):
        """現在の在室人数（``with_people_counts()`` の注釈）。"""
        return obj.num_people

    @admin.display(description=_("total joined"), ordering="sum_people")
    def sum_people(self, obj):
        """累計参加人数（退室済みを含む。``with_people_counts()`` の注釈）。"""
        return obj.sum_people


@admin.register(AnimeUser)
class AnimeUserAdmin(LogicalDeletionModelAdmin):
    # user_name は暗号化列なので、表示はできるが DB での並べ替え・検索はできない。
    list_display = ("user_name", "user_id", "is_host", "created_at", "deleted_at")


@admin.register(AnimeReaction)
class AnimeReactionAdmin(LogicalDeletionModelAdmin):
    list_display = ("reaction_id", "reaction_type", "created_at", "deleted_at")


@admin.register(Setting)
class SettingAdmin(ModelAdmin):
    list_display = (
        "room",
        "one_way",
        "owner_leave_delete",
        "disable_reaction",
        "updated_at",
    )
    ordering = ("-created_at",)


# auth の User / Group を unfold のフォームで登録し直す。
admin.site.unregister(User)
admin.site.unregister(Group)


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm

    list_display = ("username", "email", "is_staff")

    # 管理者アカウントの姓名は使わないので、一覧と編集画面から外す。
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        (_("Personal info"), {"fields": ("email",)}),
        (
            _("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (_("Important dates"), {"fields": ("last_login", "date_joined")}),
    )


@admin.register(Group)
class GroupAdmin(BaseGroupAdmin, ModelAdmin):
    pass
