"""ルーム・参加者・設定の永続化。consumer（イベントループ）から ``await`` で呼ぶ。"""

from channels.db import database_sync_to_async
from django.db import transaction

from .format import RoomSetting
from .models import AnimeReaction, AnimeRoom, AnimeUser, ReactionType, Setting
from .reactions import fold_room_reactions
from .util import is_valid_uuid

_SETTING_FIELDS = ("one_way", "owner_leave_delete", "disable_reaction")


@database_sync_to_async
def create_room(
    *, part_id: str, title: str, user_name: str, user_icon: str
) -> tuple[AnimeRoom, AnimeUser]:
    """ルームと、既定値の設定と、ホストをまとめて作る。

    途中で失敗して、誰もいない（＝誰も消さない）ルームが残ることを防ぐ。
    """
    with transaction.atomic():
        room = AnimeRoom.objects.create(part_id=part_id, title=title)
        Setting.objects.create(room=room)
        host = AnimeUser.objects.create(
            room_id=room, user_name=user_name, user_icon=user_icon, is_host=True
        )
    return room, host


@database_sync_to_async
def get_alive_room(room_id: object) -> AnimeRoom | None:
    if not is_valid_uuid(room_id):
        return None
    return AnimeRoom.objects.alive().filter(room_id=room_id).first()


@database_sync_to_async
def add_user(room: AnimeRoom, *, user_name: str, user_icon: str) -> AnimeUser:
    return AnimeUser.objects.create(
        room_id=room, user_name=user_name, user_icon=user_icon
    )


@database_sync_to_async
def refresh(user: AnimeUser, room: AnimeRoom | None = None) -> None:
    """他の接続が変えうる値（ホスト委譲・再生中の話）を読み直す。"""
    user.refresh_from_db(fields=["is_host"])
    if room is not None:
        room.refresh_from_db(fields=["part_id"])


@database_sync_to_async
def update_part_id(room: AnimeRoom, part_id: str) -> None:
    """ホストが次の話へ進んだら更新する。新しく入る人はこの話へ飛ぶ。"""
    room.part_id = part_id
    # 接続ごとに持つ古い行で他のカラムを上書きしない。
    room.save(update_fields=["part_id", "updated_at"])


@database_sync_to_async
def list_users(room: AnimeRoom) -> list[dict]:
    return list(
        AnimeUser.objects.alive()
        .filter(room_id=room)
        .order_by("created_at")
        .values("user_name", "user_id", "is_host", "user_icon")
    )


@database_sync_to_async
def remove_user(room: AnimeRoom, user: AnimeUser) -> int:
    """退室させ、残った在室人数を返す。"""
    user.delete()
    return room.alive_user_count


@database_sync_to_async
def promote_next_host(room: AnimeRoom) -> bool:
    """最も古い参加者をホストにする。誰もいなければ ``False``。

    選定と昇格を 1 トランザクションで行い、その間に抜けた人を昇格させない。
    """
    with transaction.atomic():
        next_user = (
            AnimeUser.objects.select_for_update()
            .alive()
            .filter(room_id=room)
            .order_by("created_at")
            .first()
        )
        if next_user is None:
            return False
        next_user.is_host = True
        next_user.save(update_fields=["is_host", "updated_at"])
        return True


def _close_room(room_id) -> None:
    with transaction.atomic():
        fold_room_reactions(room_id)
        AnimeUser.objects.alive().filter(room_id=room_id).delete()
        AnimeRoom.objects.alive().filter(room_id=room_id).delete()


@database_sync_to_async
def close_room(room: AnimeRoom) -> None:
    """リアクションを畳み込み、ルームと在室者を論理削除する。"""
    _close_room(room.room_id)


@database_sync_to_async
def close_room_if_empty(room_id: str) -> bool:
    """誰もいないままのルームだけを閉じる。閉じたら ``True``。"""
    if AnimeUser.objects.alive().filter(room_id=room_id).exists():
        return False
    if not AnimeRoom.objects.alive().filter(room_id=room_id).exists():
        return False
    _close_room(room_id)
    return True


@database_sync_to_async
def create_reaction(room: AnimeRoom, reaction_type: ReactionType) -> None:
    AnimeReaction.objects.create(room_id=room, reaction_type=reaction_type)


@database_sync_to_async
def load_setting(room: AnimeRoom) -> RoomSetting:
    """``Setting`` 行が無いルーム（古いデータ）では既定値を返す。"""
    setting = Setting.objects.filter(room=room).first()
    if setting is None:
        return RoomSetting()
    return RoomSetting.model_validate(setting, from_attributes=True)


@database_sync_to_async
def save_setting(room: AnimeRoom, setting: RoomSetting) -> None:
    Setting.objects.update_or_create(
        room=room, defaults=setting.model_dump(include=set(_SETTING_FIELDS))
    )
