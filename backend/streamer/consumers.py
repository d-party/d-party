import asyncio
import json

from channels.db import database_sync_to_async
from django.db import transaction
from djangochannelsrestframework.decorators import action
from djangochannelsrestframework.generics import GenericAsyncAPIConsumer

from .cron import fold_room_reactions
from .format import (
    Create,
    GroupSend,
    HostSend,
    Join,
    Leave,
    OperationNotification,
    Reaction,
    RoomSend,
    RoomSetting,
    ServerMessage,
    SettingSend,
    SpectateAck,
    SyncRequest,
    SyncResponse,
    User,
    UserAdd,
    UserList,
    UserSend,
    VideoOperation,
)
from .models import AnimeReaction, AnimeRoom, AnimeUser, ReactionType, Setting
from .util import is_valid_uuid

# 最後の 1 人が抜けてもこの秒数はルームを残す。ホストのリロードや瞬断で
# ゲストの共有リンクが failed_join にならないようにするため。予約はプロセスごとに
# 持つので、別ワーカーへの再参加は cancel できないが、削除直前の生存確認で守られる。
ROOM_GRACE_SECONDS = 60.0
_pending_room_deletes: dict[str, asyncio.Task] = {}

# クライアントから受け取る文字列の上限。永続化するものは models の max_length をそのまま使う。
# 拡張機能側の入力制限は WebSocket を直接叩けば迂回できるので、受信時に切り詰めて
# DataError（接続断）や過大なブロードキャストを防ぐ。
_USER_NAME_FIELD = AnimeUser._meta.get_field("user_name")
_USER_ICON_FIELD = AnimeUser._meta.get_field("user_icon")
USER_NAME_MAX_LENGTH: int = _USER_NAME_FIELD.max_length
USER_ICON_MAX_LENGTH: int = _USER_ICON_FIELD.max_length
PART_ID_MAX_LENGTH: int = AnimeRoom._meta.get_field("part_id").max_length
TITLE_MAX_LENGTH: int = AnimeRoom._meta.get_field("title").max_length
DEFAULT_USER_NAME: str = _USER_NAME_FIELD.default
DEFAULT_USER_ICON: str = _USER_ICON_FIELD.default
# 以下は永続化しない（ブロードキャストだけの）値なので models に対応する上限が無い。
OPERATION_MAX_LENGTH = 32
REACTION_TYPE_MAX_LENGTH = 32


def _clip(value, max_length: int, default: str = "") -> str:
    """Return ``value`` cut to ``max_length``, or ``default`` if it is not a str."""
    if not isinstance(value, str):
        return default
    return value[:max_length]


@database_sync_to_async
def _logical_delete_room_if_empty(room_id_str: str) -> bool:
    """Delete room only if it is still empty. Returns True if deleted."""
    qs = AnimeRoom.objects.alive().filter(room_id=room_id_str)
    if not qs.exists():
        return False
    if AnimeUser.objects.alive().filter(room_id=room_id_str).exists():
        return False
    fold_room_reactions(room_id_str)
    qs.delete()  # logical
    return True


def _cancel_pending_room_delete(room_id_str: str) -> None:
    """Cancel a scheduled grace-period delete if any (e.g., on rejoin)."""
    task = _pending_room_deletes.pop(room_id_str, None)
    if task and not task.done():
        task.cancel()


def _schedule_room_delete(room_id_str: str, delay: float = ROOM_GRACE_SECONDS) -> None:
    """Schedule a logical-delete after `delay` seconds, replacing any prior task."""
    _cancel_pending_room_delete(room_id_str)

    async def _delete_after() -> None:
        try:
            await asyncio.sleep(delay)
            await _logical_delete_room_if_empty(room_id_str)
        except asyncio.CancelledError:
            pass
        finally:
            _pending_room_deletes.pop(room_id_str, None)

    _pending_room_deletes[room_id_str] = asyncio.create_task(_delete_after())


class AnimePartyConsumer(GenericAsyncAPIConsumer):
    permission_classes = ()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.anime_room = None
        self.anime_user = None
        # spectate で入った接続。AnimeUser を持たない。
        self.is_spectator = False
        # Setting のキャッシュ。メッセージごとに DB を引かないため。setting_send で更新する。
        self.room_setting = None

    def _one_way(self) -> bool:
        return bool((self.room_setting or {}).get("one_way"))

    def _disable_reaction(self) -> bool:
        return bool((self.room_setting or {}).get("disable_reaction"))

    def _owner_leave_delete(self) -> bool:
        return bool((self.room_setting or {}).get("owner_leave_delete"))

    async def connect(self):
        await self.accept()

    # 1 接続は 1 ルームにだけ入る。入室済みの接続から再度これらを受けると、先の
    # AnimeUser が退室処理されないまま残り、旧グループにも所属し続けてしまう。
    ROOM_ENTRY_ACTIONS = frozenset({"create", "join", "spectate"})

    async def handle_action(self, action: str, request_id: str, **kwargs):
        if action in self.ROOM_ENTRY_ACTIONS and self.anime_room is not None:
            return
        await super().handle_action(action, request_id, **kwargs)

    async def disconnect(self, close_code):
        if self.is_spectator:
            if self.anime_room is not None:
                await self.channel_layer.group_discard(
                    str(self.anime_room.room_id), self.channel_name
                )
            return
        await self.leave_party()

    @action()
    async def create(
        self, part_id, user_name, title="", user_icon=DEFAULT_USER_ICON, **kwargs
    ):
        self.anime_room = await self.database_create_room(
            part_id=_clip(part_id, PART_ID_MAX_LENGTH),
            title=_clip(title, TITLE_MAX_LENGTH),
        )
        self.anime_user = await self.database_create_user(
            user_name=_clip(user_name, USER_NAME_MAX_LENGTH, DEFAULT_USER_NAME),
            room_id=self.anime_room,
            is_host=True,
            user_icon=_clip(user_icon, USER_ICON_MAX_LENGTH, DEFAULT_USER_ICON),
        )
        await self.channel_layer.group_add(
            str(self.anime_room.room_id), self.channel_name
        )
        user = User(**self.anime_user.__dict__)
        create = Create(room_id=self.anime_room.room_id, user=user)
        await self.send(text_data=json.dumps(create.model_dump(mode="json")))
        user_list = await self.database_user_list()
        user_list_data = UserList(user_list=user_list)
        response_data = RoomSend(
            response=user_list_data,
            sender_channel_name=self.channel_name,
        )
        await self.channel_layer.group_send(
            str(self.anime_room.room_id),
            response_data.model_dump(mode="json"),
        )
        # 設定は既定値で作り、クライアントがこの後 update_setting で変える。
        self.room_setting = await self.database_get_or_create_setting()
        await self.send(
            text_data=json.dumps(
                RoomSetting(**self.room_setting).model_dump(mode="json")
            )
        )

    @action()
    async def join(
        self, room_id: str, user_name: str, user_icon=DEFAULT_USER_ICON, **kwargs
    ):
        """user_icon は react-icons (FA6) のキー。"""
        self.anime_room = await self.database_get_or_none_room(room_id=room_id)
        if self.anime_room is None:
            failed = ServerMessage(message_type="failed_join")
            await self.send(text_data=json.dumps(failed.model_dump(mode="json")))
            await self.close()
            return
        _cancel_pending_room_delete(str(self.anime_room.room_id))
        self.anime_user = await self.database_create_user(
            user_name=_clip(user_name, USER_NAME_MAX_LENGTH, DEFAULT_USER_NAME),
            room_id=self.anime_room,
            user_icon=_clip(user_icon, USER_ICON_MAX_LENGTH, DEFAULT_USER_ICON),
        )
        await self.channel_layer.group_add(
            str(self.anime_room.room_id), self.channel_name
        )
        user = User(**self.anime_user.__dict__)
        join = Join(room_id=self.anime_room.room_id, user=user)
        await self.send(text_data=json.dumps(join.model_dump(mode="json")))
        user_add = UserAdd(user=user)
        response_data = GroupSend(
            response=user_add,
            sender_channel_name=self.channel_name,
        )
        await self.channel_layer.group_send(
            str(self.anime_room.room_id),
            response_data.model_dump(mode="json"),
        )
        user_list = await self.database_user_list()
        user_list_data = UserList(user_list=user_list)
        response_data = RoomSend(
            response=user_list_data,
            sender_channel_name=self.channel_name,
        )
        await self.channel_layer.group_send(
            str(self.anime_room.room_id),
            response_data.model_dump(mode="json"),
        )
        self.room_setting = await self.database_load_setting()
        await self.send(
            text_data=json.dumps(
                RoomSetting(**self.room_setting).model_dump(mode="json")
            )
        )

    @action()
    async def leave(self, **kwargs):
        await self.database_renew_state()
        await self.close()

    @action()
    async def spectate(self, room_id: str, **kwargs):
        """読み取り専用で参加する（タイマー画面用）。

        ``AnimeUser`` を作らないので、人数・一覧・ホスト委譲・自動削除に影響しない。
        """
        room = await self.database_get_or_none_room(room_id=room_id)
        if room is None:
            failed = ServerMessage(message_type="failed_spectate")
            await self.send(text_data=json.dumps(failed.model_dump(mode="json")))
            await self.close()
            return
        self.anime_room = room
        self.is_spectator = True
        await self.channel_layer.group_add(
            str(self.anime_room.room_id), self.channel_name
        )
        # 最初の video_operation が届く前に表示できるよう、現在の作品を返す。
        ack = SpectateAck(
            room_id=self.anime_room.room_id,
            part_id=self.anime_room.part_id,
            title=self.anime_room.title,
        )
        await self.send(text_data=json.dumps(ack.model_dump(mode="json")))

    @action()
    async def video_operation(
        self, operation: str, option: dict, title: str | None = None, **kwargs
    ):
        """送信元以外へ再生操作を配信する。

        ``title`` はタイマー画面がエピソードの切り替えに追従するために使う。
        """
        if self.anime_room is None or self.anime_user is None:
            return
        await self.database_renew_state()
        if not self.anime_user.is_host and self._one_way():
            return
        video_operation = VideoOperation(
            room_id=self.anime_room.room_id,
            operation=_clip(operation, OPERATION_MAX_LENGTH),
            user=User(**self.anime_user.__dict__).model_dump(),
            option=option,
            title=None if title is None else _clip(title, TITLE_MAX_LENGTH),
        )
        response_data = GroupSend(
            response=video_operation,
            sender_channel_name=self.channel_name,
        )
        if (
            video_operation.option.part_id != self.anime_room.part_id
            and len(video_operation.option.part_id) <= PART_ID_MAX_LENGTH
            and self.anime_user.is_host
        ):
            await self.database_update_room_part_id(video_operation.option.part_id)
        await self.channel_layer.group_send(
            str(self.anime_room.room_id),
            response_data.model_dump(mode="json"),
        )

    @action()
    async def sync_request(self, **kwargs):
        """ホストに現在の再生状態を問い合わせる。"""
        if self.anime_room is None or self.anime_user is None:
            return
        await self.database_renew_state()
        sync_request = SyncRequest(user=User(**self.anime_user.__dict__).model_dump())
        response_data = HostSend(
            response=sync_request,
            sender_channel_name=self.channel_name,
        )
        await self.channel_layer.group_send(
            str(self.anime_room.room_id),
            response_data.model_dump(mode="json"),
        )

    @action()
    async def sync_response(self, to_user: dict, option: dict, **kwargs):
        """sync_request の送り主（``to_user``）へホストの再生状態を返す。"""
        if self.anime_room is None or self.anime_user is None:
            return
        await self.database_renew_state()
        sync_response = SyncResponse(option=option)
        response_data = UserSend(
            response=sync_response,
            to_user=to_user,
            sender_channel_name=self.channel_name,
        )
        await self.channel_layer.group_send(
            str(self.anime_room.room_id),
            response_data.model_dump(mode="json"),
        )

    @action()
    async def operation_notification(self, operation: str, **kwargs):
        if self.anime_room is None or self.anime_user is None:
            return
        await self.database_renew_state()
        operation_notification = OperationNotification(
            room_id=self.anime_room.room_id,
            operation=_clip(operation, OPERATION_MAX_LENGTH),
            user=User(**self.anime_user.__dict__).model_dump(),
        )
        response_data = GroupSend(
            response=operation_notification, sender_channel_name=self.channel_name
        )
        await self.channel_layer.group_send(
            str(self.anime_room.room_id),
            response_data.model_dump(mode="json"),
        )

    @action()
    async def reaction(self, reaction_type: str, **kwargs):
        """配信し、既定のリアクション（``ReactionType``）だけを統計用に保存する。

        エクストラリアクション（Noto のコードポイント）は配信のみ。
        """
        if self.anime_room is None or self.anime_user is None:
            return
        # 送信者自身の画面には拡張機能が表示するので、ここでは捨てるだけでよい。
        if self._disable_reaction():
            return
        if (
            not isinstance(reaction_type, str)
            or len(reaction_type) > REACTION_TYPE_MAX_LENGTH
        ):
            return
        reaction = Reaction(
            reaction_type=reaction_type,
            user=User(**self.anime_user.__dict__).model_dump(),
        )
        response_data = GroupSend(
            response=reaction, sender_channel_name=self.channel_name
        )
        await self.channel_layer.group_send(
            str(self.anime_room.room_id),
            response_data.model_dump(mode="json"),
        )
        if reaction_type in ReactionType.__members__:
            await self.database_create_reaction(reaction_type=reaction_type)

    @action()
    async def user_list(self, **kwargs):
        if self.anime_room is None or self.anime_user is None:
            return
        user_list = await self.database_user_list()
        response_data = UserList(user_list=user_list)
        await self.send(text_data=json.dumps(response_data.model_dump(mode="json")))

    @action()
    async def delete_room(self, **kwargs):
        """ホストだけが実行できる。全員へ ``room_deleted`` を送ってから削除する。"""
        if self.anime_room is None or self.anime_user is None:
            return
        await self.database_renew_state()
        if not self.anime_user.is_host:
            return
        room_id_str = str(self.anime_room.room_id)
        _cancel_pending_room_delete(room_id_str)
        server_message = ServerMessage(message_type="room_deleted")
        response_data = RoomSend(
            response=server_message,
            sender_channel_name=self.channel_name,
        )
        await self.channel_layer.group_send(
            room_id_str,
            response_data.model_dump(mode="json"),
        )
        await self.database_delete_room_and_users()

    @action()
    async def update_setting(
        self,
        one_way: bool = False,
        owner_leave_delete: bool = False,
        disable_reaction: bool = False,
        **kwargs,
    ):
        """ホストだけが実行できる。全員へ ``room_setting`` を配信する。"""
        if self.anime_room is None or self.anime_user is None:
            return
        await self.database_renew_state()
        if not self.anime_user.is_host:
            return
        self.room_setting = await self.database_update_setting(
            one_way=bool(one_way),
            owner_leave_delete=bool(owner_leave_delete),
            disable_reaction=bool(disable_reaction),
        )
        room_setting = RoomSetting(**self.room_setting)
        response_data = SettingSend(
            response=room_setting,
            sender_channel_name=self.channel_name,
        )
        await self.channel_layer.group_send(
            str(self.anime_room.room_id),
            response_data.model_dump(mode="json"),
        )

    async def room_send(self, data: dict):
        """送信者を含む全員へ送る。"""
        await self.send(text_data=json.dumps(data["response"]))

    async def setting_send(self, data: dict):
        """全員へ送り、各接続の ``room_setting`` キャッシュも更新する。"""
        response = data["response"]
        self.room_setting = {
            "one_way": bool(response.get("one_way", False)),
            "owner_leave_delete": bool(response.get("owner_leave_delete", False)),
            "disable_reaction": bool(response.get("disable_reaction", False)),
        }
        await self.send(text_data=json.dumps(response))

    async def group_send(self, data: dict):
        """送信者以外へ送る。"""
        if self.channel_name != data["sender_channel_name"]:
            await self.send(text_data=json.dumps(data["response"]))

    async def host_send(self, data: dict):
        """ホストだけへ送る。"""
        if self.anime_user is None:
            return
        await self.database_renew_state()
        if self.channel_name != data["sender_channel_name"] and self.anime_user.is_host:
            await self.send(text_data=json.dumps(data["response"]))

    async def user_send(self, data: dict):
        """``data["to_user"]`` のユーザーだけへ送る。"""
        if self.anime_user is None:
            return
        if self.channel_name != data["sender_channel_name"] and str(
            self.anime_user.user_id
        ) == str(data["to_user"]["user_id"]):
            await self.send(text_data=json.dumps(data["response"]))

    async def leave_party(self):
        if self.anime_room is None or self.anime_user is None:
            return
        leave = Leave(user=User(**self.anime_user.__dict__).model_dump())
        response_data = GroupSend(
            response=leave,
            sender_channel_name=self.channel_name,
        )

        await self.database_delete_user()
        user_count = await self.database_get_user_count()
        if self.anime_user.is_host and self._owner_leave_delete():
            room_id_str = str(self.anime_room.room_id)
            _cancel_pending_room_delete(room_id_str)
            server_message = ServerMessage(message_type="room_deleted")
            send_data = RoomSend(
                response=server_message,
                sender_channel_name=self.channel_name,
            )
            await self.channel_layer.group_send(
                room_id_str,
                send_data.model_dump(mode="json"),
            )
            await self.database_delete_room_and_users()
            await self.channel_layer.group_discard(room_id_str, self.channel_name)
            return
        if user_count < 1:
            _schedule_room_delete(str(self.anime_room.room_id))
        if user_count >= 1 and self.anime_user.is_host:
            next_host = await self.database_promote_next_host()
            if next_host is not None:
                server_message = ServerMessage(message_type="host_change")
                send_data = HostSend(
                    response=server_message, sender_channel_name=self.channel_name
                )
                await self.channel_layer.group_send(
                    str(self.anime_room.room_id),
                    send_data.model_dump(mode="json"),
                )
        await self.channel_layer.group_send(
            str(self.anime_room.room_id),
            response_data.model_dump(mode="json"),
        )
        user_list = await self.database_user_list()
        user_list_data = UserList(user_list=user_list)
        response_data = RoomSend(
            response=user_list_data,
            sender_channel_name=self.channel_name,
        )
        await self.channel_layer.group_send(
            str(self.anime_room.room_id),
            response_data.model_dump(mode="json"),
        )
        await self.channel_layer.group_discard(
            str(self.anime_room.room_id), self.channel_name
        )

    @database_sync_to_async
    def database_create_user(
        self,
        user_name: str,
        room_id,
        is_host: bool = False,
        user_icon: str = DEFAULT_USER_ICON,
    ):
        return AnimeUser.objects.create(
            user_name=user_name, room_id=room_id, is_host=is_host, user_icon=user_icon
        )

    @database_sync_to_async
    def database_delete_user(self):
        self.anime_user.delete()

    @database_sync_to_async
    def database_create_room(self, part_id: str, title: str = ""):
        return AnimeRoom.objects.create(part_id=part_id, title=title)

    @database_sync_to_async
    def database_update_room_part_id(self, part_id: str):
        """ホストが次の話へ進んだら更新する。新しく入る人はこの話へ飛ぶ。"""
        self.anime_room.part_id = part_id
        # 接続ごとに持つ古い行で他のカラムを上書きしない。
        self.anime_room.save(update_fields=["part_id", "updated_at"])

    @database_sync_to_async
    def database_delete_room_and_users(self):
        room_id = self.anime_room.room_id
        fold_room_reactions(room_id)
        AnimeUser.objects.alive().filter(room_id=room_id).delete()
        AnimeRoom.objects.alive().filter(room_id=room_id).delete()

    @database_sync_to_async
    def database_promote_next_host(self):
        """最も古い参加者をホストにする。ルームが空なら ``None``。

        選定と昇格を 1 トランザクションで行い、その間に抜けた人を昇格させない。
        """
        with transaction.atomic():
            next_user = (
                AnimeUser.objects.select_for_update()
                .alive()
                .filter(room_id=self.anime_room.room_id)
                .order_by("created_at")
                .first()
            )
            if next_user is None:
                return None
            next_user.is_host = True
            next_user.save(update_fields=["is_host"])
            return next_user

    @database_sync_to_async
    def database_get_user_count(self):
        ar = AnimeRoom.objects.get(room_id=self.anime_room.room_id)
        return ar.alive_user_count

    @database_sync_to_async
    def database_get_or_none_room(self, room_id):
        if not is_valid_uuid(uuid_to_test=room_id):
            return None
        return AnimeRoom.objects.alive().filter(room_id=room_id).first()

    @database_sync_to_async
    def database_renew_state(self):
        user_id = self.anime_user.user_id
        self.anime_user = AnimeUser.objects.get(user_id=user_id)
        room_id = self.anime_room.room_id
        self.anime_room = AnimeRoom.objects.get(room_id=room_id)

    @database_sync_to_async
    def database_user_list(self):
        ar = AnimeRoom.objects.get(room_id=self.anime_room.room_id)
        user_list = ar.inroom.alive().values(
            "user_name", "user_id", "is_host", "user_icon"
        )
        return list(user_list)

    @database_sync_to_async
    def database_create_reaction(self, reaction_type):
        return AnimeReaction.objects.create(
            room_id=self.anime_room, reaction_type=ReactionType[reaction_type].value
        )

    @staticmethod
    def _setting_to_dict(setting: Setting) -> dict:
        return {
            "one_way": setting.one_way,
            "owner_leave_delete": setting.owner_leave_delete,
            "disable_reaction": setting.disable_reaction,
        }

    @database_sync_to_async
    def database_get_or_create_setting(self):
        setting, _ = Setting.objects.get_or_create(room=self.anime_room)
        return self._setting_to_dict(setting)

    @database_sync_to_async
    def database_load_setting(self):
        """Setting 行が無いルームでは既定値（すべて False）を返す。"""
        setting = Setting.objects.filter(room=self.anime_room).first()
        if setting is None:
            return {
                "one_way": False,
                "owner_leave_delete": False,
                "disable_reaction": False,
            }
        return self._setting_to_dict(setting)

    @database_sync_to_async
    def database_update_setting(
        self, one_way: bool, owner_leave_delete: bool, disable_reaction: bool
    ):
        setting, _ = Setting.objects.get_or_create(room=self.anime_room)
        setting.one_way = one_way
        setting.owner_leave_delete = owner_leave_delete
        setting.disable_reaction = disable_reaction
        setting.save(
            update_fields=[
                "one_way",
                "owner_leave_delete",
                "disable_reaction",
                "updated_at",
            ]
        )
        return self._setting_to_dict(setting)
