import uuid
from typing import TYPE_CHECKING, ClassVar

from django.db import models
from django.db.models import Count, Q

from .fields import EncryptedCharField
from .mixins import (
    LogicalDeletionManager,
    LogicalDeletionMixin,
    LogicalDeletionQuerySet,
)


class BaseRoomQuerySet(LogicalDeletionQuerySet):
    """ルーム用のクエリセット。人数の集計ヘルパを提供する。

    ``AnimeRoom`` / ``DmmRoom`` の両方で使う。人数の導出は参加ユーザー
    （``inroom`` の related_name）を数えるだけなので、サービスに依存しない。
    """

    def with_people_counts(self):
        """``num_people`` / ``sum_people`` を参加ユーザーから導出して注釈する。

        * ``num_people``: 現在の在室人数（論理削除されていない参加ユーザー）。
        * ``sum_people``: 累計参加人数（退室済み＝論理削除済みも含む）。
          参加ユーザーは物理削除されないため、これが累計になる。

        ホストを含み、spectate の接続は含まない。
        """
        return self.annotate(
            num_people=Count("inroom", filter=Q(inroom__deleted_at__isnull=True)),
            sum_people=Count("inroom"),
        )


class BaseRoomManager(LogicalDeletionManager.from_queryset(BaseRoomQuerySet)):  # type: ignore[misc]
    """``BaseRoomQuerySet`` を公開するマネージャ。"""


# ---------------------------------------------------------------------------
# 抽象基底モデル（サービス共通のスキーマ）
#
# d-party は dアニメストア（``Anime*``）と DMM TV（``Dmm*``）の 2 サービスを扱う。
# 同時視聴の同期ロジック（consumer / stats / grace 削除）はサービス非依存なので、
# テーブルのスキーマも共通化する。共通フィールドをここに抽象基底として置き、
# サービスごとの具象モデルが継承する。**抽象継承は純 Python なので既存の
# ``anime_*`` テーブルにはスキーマ変化が起きない**（マイグレーション不要）。
#
# 具象モデルへの外部キー（``room`` 参照）だけは、参照先が具象ごとに異なるため
# 抽象基底に置けない（抽象基底の FK は単一ターゲットに固定されてしまう）。
# そのため FK/OneToOne は各具象モデル側で宣言する。
# ---------------------------------------------------------------------------


class BaseRoom(LogicalDeletionMixin):
    """ルームの共通スキーマ。具象は ``AnimeRoom`` / ``DmmRoom``。"""

    room_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    part_id = models.CharField(max_length=16)
    # 作成時に拡張機能が送る作品名（以後は更新しない）。OGP などに使う。
    title = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects: ClassVar[BaseRoomManager] = BaseRoomManager()

    if TYPE_CHECKING:
        # 参加ユーザーからの逆参照。``related_name="inroom"`` は具象モデル側の FK
        # （``AnimeUser.room_id`` / ``DmmUser.room_id``）で宣言されるため、抽象基底
        # からは静的に見えない。実行時は Django が付けるので、型検査のためだけに
        # ここで宣言しておく。
        inroom: LogicalDeletionManager

    class Meta:
        abstract = True

    @property
    def alive_user_count(self) -> int:
        """現在の在室人数。複数行では ``with_people_counts()`` を使う（N+1 になる）。"""
        return self.inroom.alive().count()

    @property
    def total_user_count(self) -> int:
        """累計参加人数（退室済みも含む）。``alive_user_count`` と同じ注意点がある。"""
        return self.inroom.count()


class BaseSetting(models.Model):
    """ルームごとの詳細設定の共通スキーマ。具象は ``Setting`` / ``DmmSetting``。

    ルーム作成時にすべて ``False`` で作り、ホストだけが ``update_setting`` で変えられる。
    主キー兼外部キーの ``room`` は具象側で宣言する。

    Attributes:
        one_way: ホスト以外の再生操作を捨てる（リアクションは通す）。
        owner_leave_delete: ホストが抜けたらルームを消す。
        disable_reaction: リアクションを配信も保存もしない。
    """

    one_way = models.BooleanField(default=False)
    owner_leave_delete = models.BooleanField(default=False)
    disable_reaction = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # 抽象基底に既定マネージャを明示（挙動は既定と同一・マイグレーション不要）。具象を
    # ``type[BaseSetting]`` として扱う consumer から ``.objects`` を型安全に参照するため。
    objects = models.Manager()

    class Meta:
        abstract = True


class BaseUser(LogicalDeletionMixin):
    """参加ユーザーの共通スキーマ。具象は ``AnimeUser`` / ``DmmUser``。"""

    user_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_name = EncryptedCharField(default="user", max_length=20)
    # react-icons (Font Awesome 6) のキー。個人情報ではないので平文。
    user_icon = models.CharField(default="FaRegUser", max_length=64)
    is_host = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

    def __str__(self):
        return self.user_name


class ReactionType(models.TextChoices):
    cry = "C", "cry"
    middle_finger = "MF", "middle_finger"
    smile = "S", "smile"
    thumbs_up = "TU", "thumbs_up"
    fav = "F", "favorite"


class BaseReaction(LogicalDeletionMixin):
    """リアクション（1 タップ = 1 行）の共通スキーマ。具象は ``AnimeReaction`` / ``DmmReaction``。"""

    reaction_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reaction_type = models.CharField(max_length=3, choices=ReactionType.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class BaseRoomHistory(models.Model):
    """入退室履歴の共通スキーマ。具象は ``AnimeRoomHistory`` / ``DmmRoomHistory``。"""

    user_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=20)

    class Meta:
        abstract = True


class BaseReactionStat(models.Model):
    """日次 × 種別に畳み込んだリアクションの集計（共通スキーマ）。

    ルーム終了時に ``cron.fold_room_reactions`` がそのルームのリアクションをここへ加算し、
    元の行は物理削除する。``(date, reaction_type)`` で一意。

    具象（``ReactionStat`` / ``DmmReactionStat``）は制約・インデックス名が衝突しないよう
    それぞれ独自の ``Meta`` を宣言する。
    """

    date = models.DateField()
    reaction_type = models.CharField(max_length=3, choices=ReactionType.choices)
    count = models.PositiveIntegerField(default=0)

    class Meta:
        abstract = True


# ---------------------------------------------------------------------------
# dアニメストア（既存）: フィールド定義は従来と完全同一に保つ。抽象継承は純 Python
# なので ``streamer_animeroom`` などの既存テーブルにマイグレーションは発生しない。
# ---------------------------------------------------------------------------


class AnimeRoom(BaseRoom):
    pass


class Setting(BaseSetting):
    room = models.OneToOneField(
        AnimeRoom,
        primary_key=True,
        on_delete=models.CASCADE,
        related_name="setting",
    )


class AnimeUser(BaseUser):
    room_id = models.ForeignKey(
        AnimeRoom, on_delete=models.CASCADE, related_name="inroom"
    )


class AnimeReaction(BaseReaction):
    room_id = models.ForeignKey(AnimeRoom, on_delete=models.CASCADE)


class AnimeRoomHistory(BaseRoomHistory):
    room_id = models.ForeignKey(AnimeRoom, on_delete=models.CASCADE)


class ReactionStat(BaseReactionStat):
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["date", "reaction_type"], name="uniq_reactionstat_date_type"
            )
        ]
        indexes = [models.Index(fields=["date"])]


# ---------------------------------------------------------------------------
# DMM TV（新規）: 具象のみ追加。新テーブルなので追加マイグレーションのみが生成される。
# ---------------------------------------------------------------------------


class DmmRoom(BaseRoom):
    # DMM TV の content/season id は英数字で 25 文字前後あり、dアニメストアの数値 partId
    # より長い。抽象基底の part_id(max_length=16) を DMM 向けに拡張する（既存 anime 側の
    # スキーマには影響しない。抽象基底フィールドの上書きは Django が許可している）。
    part_id = models.CharField(max_length=128)


class DmmSetting(BaseSetting):
    room = models.OneToOneField(
        DmmRoom,
        primary_key=True,
        on_delete=models.CASCADE,
        related_name="setting",
    )


class DmmUser(BaseUser):
    room_id = models.ForeignKey(
        DmmRoom, on_delete=models.CASCADE, related_name="inroom"
    )


class DmmReaction(BaseReaction):
    room_id = models.ForeignKey(DmmRoom, on_delete=models.CASCADE)


class DmmRoomHistory(BaseRoomHistory):
    room_id = models.ForeignKey(DmmRoom, on_delete=models.CASCADE)


class DmmReactionStat(BaseReactionStat):
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["date", "reaction_type"],
                name="uniq_dmm_reactionstat_date_type",
            )
        ]
        indexes = [models.Index(fields=["date"])]
