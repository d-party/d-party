"""ルーム・参加者・設定の永続化。consumer（イベントループ）から ``await`` で呼ぶ。

サービス（dアニメストア / DMM TV）ごとにテーブルが分かれている。ルームを受け取る関数は
そのルームのサービスで、受け取らない関数は ``service`` 引数のサービスで動く。
"""

from channels.db import database_sync_to_async
from django.db import transaction

from .format import RoomSetting
from .models import SERVICES, BaseRoom, BaseUser, ReactionType, Service
from .reactions import fold_room_reactions
from .util import is_valid_uuid

_SETTING_FIELDS = ("one_way", "owner_leave_delete", "disable_reaction")


def _service_of(room: BaseRoom) -> Service:
    return next(service for service in SERVICES if isinstance(room, service.room))


@database_sync_to_async
def create_room(
    service: Service, *, part_id: str, title: str, user_name: str, user_icon: str
) -> tuple[BaseRoom, BaseUser]:
    """ルームと、既定値の設定と、ホストをまとめて作る。

    途中で失敗して、誰もいない（＝誰も消さない）ルームが残ることを防ぐ。
    """
    with transaction.atomic():
        room = service.room.objects.create(part_id=part_id, title=title)
        service.setting.objects.create(room=room)  # type: ignore[misc]
        host = service.user.objects.create(
            room_id=room, user_name=user_name, user_icon=user_icon, is_host=True
        )
    return room, host


@database_sync_to_async
def get_alive_room(service: Service, room_id: object) -> BaseRoom | None:
    if not is_valid_uuid(room_id):
        return None
    return service.room.objects.alive().filter(room_id=room_id).first()


@database_sync_to_async
def add_user(room: BaseRoom, *, user_name: str, user_icon: str) -> BaseUser:
    return _service_of(room).user.objects.create(
        room_id=room, user_name=user_name, user_icon=user_icon
    )


@database_sync_to_async
def refresh(user: BaseUser, room: BaseRoom | None = None) -> None:
    """他の接続が変えうる値（ホスト委譲・再生中の話）を読み直す。"""
    user.refresh_from_db(fields=["is_host"])
    if room is not None:
        room.refresh_from_db(fields=["part_id"])


@database_sync_to_async
def update_part_id(room: BaseRoom, part_id: str) -> None:
    """ホストが次の話へ進んだら更新する。新しく入る人はこの話へ飛ぶ。"""
    room.part_id = part_id
    # 接続ごとに持つ古い行で他のカラムを上書きしない。
    room.save(update_fields=["part_id", "updated_at"])


@database_sync_to_async
def list_users(room: BaseRoom) -> list[dict]:
    return list(
        _service_of(room)
        .user.objects.alive()
        .filter(room_id=room)
        .order_by("created_at")
        .values("user_name", "user_id", "is_host", "user_icon")
    )


@database_sync_to_async
def remove_user(room: BaseRoom, user: BaseUser) -> int:
    """退室させ、残った在室人数を返す。"""
    user.delete()
    return room.alive_user_count


@database_sync_to_async
def promote_next_host(room: BaseRoom) -> bool:
    """最も古い参加者をホストにする。誰もいなければ ``False``。

    選定と昇格を 1 トランザクションで行い、その間に抜けた人を昇格させない。
    """
    with transaction.atomic():
        next_user = (
            _service_of(room)
            .user.objects.select_for_update()
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


def _close_room(service: Service, room_id) -> None:
    with transaction.atomic():
        fold_room_reactions(room_id, service=service)
        service.user.objects.alive().filter(room_id=room_id).delete()
        service.room.objects.alive().filter(room_id=room_id).delete()


@database_sync_to_async
def close_room(room: BaseRoom) -> None:
    """リアクションを畳み込み、ルームと在室者を論理削除する。"""
    _close_room(_service_of(room), room.room_id)


@database_sync_to_async
def close_room_if_empty(service: Service, room_id: str) -> bool:
    """誰もいないままのルームだけを閉じる。閉じたら ``True``。"""
    if service.user.objects.alive().filter(room_id=room_id).exists():
        return False
    if not service.room.objects.alive().filter(room_id=room_id).exists():
        return False
    _close_room(service, room_id)
    return True


@database_sync_to_async
def create_reaction(room: BaseRoom, reaction_type: ReactionType) -> None:
    _service_of(room).reaction.objects.create(room_id=room, reaction_type=reaction_type)


@database_sync_to_async
def load_setting(room: BaseRoom) -> RoomSetting:
    """設定の行が無いルーム（古いデータ）では既定値を返す。"""
    # ``room`` は具象の Setting / DmmSetting が宣言するので、抽象 BaseSetting 越しでは
    # django-stubs が解決できない。
    setting = _service_of(room).setting.objects.filter(room=room).first()  # type: ignore[misc]
    if setting is None:
        return RoomSetting()
    return RoomSetting.model_validate(setting, from_attributes=True)


@database_sync_to_async
def save_setting(room: BaseRoom, setting: RoomSetting) -> None:
    _service_of(room).setting.objects.update_or_create(  # type: ignore[misc]
        room=room, defaults=setting.model_dump(include=set(_SETTING_FIELDS))
    )
