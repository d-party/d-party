import uuid
from typing import ClassVar

from django.db import models
from django.db.models import Count, Q

from .fields import EncryptedCharField
from .mixins import (
    LogicalDeletionManager,
    LogicalDeletionMixin,
    LogicalDeletionQuerySet,
)

# 列の長さ。WebSocket の入力検証（``format.py``）も同じ値を使う。
PART_ID_MAX_LENGTH = 16
TITLE_MAX_LENGTH = 255
USER_NAME_MAX_LENGTH = 20
USER_ICON_MAX_LENGTH = 64
DEFAULT_USER_NAME = "user"
# react-icons (Font Awesome 6) のキー。
DEFAULT_USER_ICON = "FaRegUser"


class AnimeRoomQuerySet(LogicalDeletionQuerySet):
    """``AnimeRoom`` 用のクエリセット。人数の集計ヘルパを提供する。"""

    def with_people_counts(self):
        """``num_people`` / ``sum_people`` を ``AnimeUser`` から導出して注釈する。

        * ``num_people``: 現在の在室人数（論理削除されていない ``AnimeUser``）。
        * ``sum_people``: 累計参加人数（退室済み＝論理削除済みも含む）。
          ``AnimeUser`` は物理削除されないため、これが累計になる。

        ホストを含み、spectate の接続は含まない。
        """
        return self.annotate(
            num_people=Count("inroom", filter=Q(inroom__deleted_at__isnull=True)),
            sum_people=Count("inroom"),
        )


class AnimeRoomManager(LogicalDeletionManager.from_queryset(AnimeRoomQuerySet)):  # type: ignore[misc]
    """``AnimeRoomQuerySet`` を公開するマネージャ。"""


class AnimeRoom(LogicalDeletionMixin):
    room_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    part_id = models.CharField(max_length=PART_ID_MAX_LENGTH)
    # 作成時に拡張機能が送る作品名（以後は更新しない）。OGP などに使う。
    title = models.CharField(max_length=TITLE_MAX_LENGTH, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects: ClassVar[AnimeRoomManager] = AnimeRoomManager()

    @property
    def alive_user_count(self) -> int:
        """現在の在室人数。複数行では ``with_people_counts()`` を使う（N+1 になる）。"""
        return self.inroom.alive().count()

    @property
    def total_user_count(self) -> int:
        """累計参加人数（退室済みも含む）。``alive_user_count`` と同じ注意点がある。"""
        return self.inroom.count()


class Setting(models.Model):
    """ルームごとの詳細設定。ルームと 1:1 で対応し、``room`` を主キーとして共有する。

    ルーム作成時にすべて ``False`` で作り、ホストだけが ``update_setting`` で変えられる。

    Attributes:
        room: 主キー兼外部キー。
        one_way: ホスト以外の再生操作を捨てる（リアクションは通す）。
        owner_leave_delete: ホストが抜けたらルームを消す。
        disable_reaction: リアクションを配信も保存もしない。
    """

    room = models.OneToOneField(
        AnimeRoom,
        primary_key=True,
        on_delete=models.CASCADE,
        related_name="setting",
    )
    one_way = models.BooleanField(default=False)
    owner_leave_delete = models.BooleanField(default=False)
    disable_reaction = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class AnimeUser(LogicalDeletionMixin):
    user_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_name = EncryptedCharField(
        default=DEFAULT_USER_NAME, max_length=USER_NAME_MAX_LENGTH
    )
    # 個人情報ではないので平文。
    user_icon = models.CharField(
        default=DEFAULT_USER_ICON, max_length=USER_ICON_MAX_LENGTH
    )
    room_id = models.ForeignKey(
        AnimeRoom, on_delete=models.CASCADE, related_name="inroom"
    )
    is_host = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user_name


class ReactionType(models.TextChoices):
    cry = "C", "cry"
    middle_finger = "MF", "middle_finger"
    smile = "S", "smile"
    thumbs_up = "TU", "thumbs_up"
    fav = "F", "favorite"


class AnimeReaction(LogicalDeletionMixin):
    reaction_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room_id = models.ForeignKey(AnimeRoom, on_delete=models.CASCADE)
    reaction_type = models.CharField(max_length=3, choices=ReactionType.choices)
    created_at = models.DateTimeField(auto_now_add=True)


class AnimeRoomHistory(models.Model):
    user_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    room_id = models.ForeignKey(AnimeRoom, on_delete=models.CASCADE)
    type = models.CharField(max_length=20)


class ReactionStat(models.Model):
    """日次 × 種別に畳み込んだリアクションの集計。

    ルーム終了時に ``reactions.fold_room_reactions`` が ``AnimeReaction`` をここへ加算し、
    元の行は物理削除する。``(date, reaction_type)`` で一意。
    """

    date = models.DateField()
    reaction_type = models.CharField(max_length=3, choices=ReactionType.choices)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["date", "reaction_type"], name="uniq_reactionstat_date_type"
            )
        ]
        indexes = [models.Index(fields=["date"])]
