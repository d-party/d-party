"""同時視聴の WebSocket consumer。メッセージの形は ``format.py``、永続化は ``repository.py``。"""

import asyncio
import functools
import json
import logging
from typing import ClassVar

from django.http import Http404
from djangochannelsrestframework.consumers import AsyncAPIConsumer
from djangochannelsrestframework.decorators import action
from pydantic import BaseModel, ValidationError
from rest_framework.exceptions import APIException

from . import repository
from .format import (
    BaseGroupSend,
    Create,
    CreateRequest,
    GroupSend,
    HostSend,
    Join,
    JoinRequest,
    Leave,
    OperationNotification,
    OperationNotificationRequest,
    Reaction,
    ReactionRequest,
    ResponseBaseFormat,
    RoomSend,
    RoomSetting,
    ServerMessage,
    SettingSend,
    SpectateAck,
    SpectateRequest,
    SyncRequest,
    SyncResponse,
    SyncResponseRequest,
    User,
    UserAdd,
    UserList,
    UserSend,
    VideoOperation,
    VideoOperationRequest,
)
from .models import ANIME_STORE, DMM_TV, BaseRoom, BaseUser, ReactionType, Service

logger = logging.getLogger(__name__)

# RFC 6455 の close code。
CLOSE_NORMAL = 1000
CLOSE_POLICY_VIOLATION = 1008
CLOSE_INTERNAL_ERROR = 1011

# 1 フレームの文字数の上限。本番は uvicorn の ws_max_size（d_party/workers.py の
# WS_MAX_SIZE。こちらはバイト数）が先に切るが、dev の runserver や設定漏れでも
# json.loads に巨大な入力を渡さない。
MAX_FRAME_LENGTH = 64 * 1024


def _frame_content(text_data: str | None) -> dict | None:
    """フレームを action のメッセージとして読む。読めなければ ``None``。

    ``self`` キーは DCRF が ``handle_action(**content)`` に展開したときに引数の束縛で
    TypeError になり、``action`` が文字列でないと ``available_actions`` の検索で落ちる。
    どちらも ``handle_action`` の try より前なので、ここで弾く。
    """
    if not text_data or len(text_data) > MAX_FRAME_LENGTH:
        return None
    try:
        content = json.loads(text_data)
    # JSONDecodeError と整数の桁数の上限は ValueError。RecursionError は念のため
    # （上の文字数では json の C 実装は再帰の上限に届かない）。
    except ValueError, RecursionError:
        return None
    if not isinstance(content, dict) or "self" in content:
        return None
    if not isinstance(content.get("action", ""), str):
        return None
    return content


# 最後の 1 人が抜けてもこの秒数はルームを残す。ホストのリロードや瞬断で
# ゲストの共有リンクが failed_join にならないようにするため。予約はプロセスごとに
# 持つので、別ワーカーへの再参加は cancel できないが、削除直前の生存確認で守られる。
ROOM_GRACE_SECONDS = 60.0
_pending_room_deletes: dict[str, asyncio.Task] = {}


def _cancel_pending_room_delete(group: str) -> None:
    task = _pending_room_deletes.pop(group, None)
    if task and not task.done():
        task.cancel()


def _schedule_room_delete(
    service: Service, group: str, delay: float = ROOM_GRACE_SECONDS
) -> None:
    _cancel_pending_room_delete(group)

    async def delete_after() -> None:
        try:
            await asyncio.sleep(delay)
            await repository.close_room_if_empty(service, group)
        finally:
            # 後から予約し直されたタスクを消さない。
            if _pending_room_deletes.get(group) is task:
                del _pending_room_deletes[group]

    task = asyncio.create_task(delete_after())
    _pending_room_deletes[group] = task


def _group_of(room: BaseRoom) -> str:
    return str(room.room_id)


def _wire_user(user: BaseUser) -> User:
    return User.model_validate(user, from_attributes=True)


def _member_action(request_model: type[BaseModel] | None = None):
    """入室済みの参加者だけが呼べる action。未入室や spectate の接続からは無視する。

    ハンドラは ``(self, room, user)``、``request_model`` があれば検証済みの入力を加えた
    ``(self, room, user, request)`` で呼ばれる。
    """

    def decorator(handler):
        @action()
        @functools.wraps(handler)
        async def wrapper(self: BasePartyConsumer, **payload) -> None:
            room, user = self._room, self._user
            if room is None or user is None:
                return
            if request_model is None:
                await handler(self, room, user)
                return
            # 基底クラスが足す ``action`` を、同名のフィールドを持つモデルへ流し込まない。
            payload.pop("action", None)
            await handler(self, room, user, request_model.model_validate(payload))

        return wrapper

    return decorator


class BasePartyConsumer(AsyncAPIConsumer):
    """同時視聴の consumer の共通実装。

    dアニメストア（``AnimePartyConsumer``）と DMM TV（``DmmPartyConsumer``）は、扱うモデル
    一式（``service``）だけを差し替える。``part_id`` / ``title`` / 動画の ``option`` は
    不透明な文字列として中継するだけで、サービス固有のプレイヤーの知識は持たない。
    """

    permission_classes = ()
    service: ClassVar[Service]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._room: BaseRoom | None = None
        # spectate の接続は参加ユーザーを持たない。
        self._user: BaseUser | None = None
        # Setting のキャッシュ。メッセージごとに DB を引かないため。setting_send で更新する。
        self._setting = RoomSetting()
        # 閉じた後も、同じ読み込みで届いていたフレームは処理されうる。二重に閉じない。
        self._closing = False

    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        await self._leave()

    async def receive(self, text_data=None, bytes_data=None, **kwargs):
        """壊れたフレームでも、後始末をしてから接続を閉じる。

        基底クラスは、JSON として読めない・オブジェクトでない・バイナリのフレームで
        ``handle_action`` より前に例外を投げる。それだと ``handle_exception`` を通らず、
        ``disconnect`` も呼ばれないので、在室者の行が alive のまま残る。
        """
        if self._closing:
            return
        content = _frame_content(text_data)
        if content is None:
            # フレームの中身はログへ出さない。
            logger.warning(
                "malformed websocket frame (%s, %d chars)",
                "binary" if text_data is None else "text",
                len(text_data or bytes_data or ""),
            )
            await self._abort(CLOSE_POLICY_VIOLATION)
            return
        try:
            await self.receive_json(content, **kwargs)
        # 上で弾けなかったものの受け皿。ここを抜けると disconnect が呼ばれない。
        except Exception as exc:
            # handle_exception が後始末を始めた後に（切断済みの close などで）出た例外は、
            # もう一度記録して閉じ直さない。
            if self._closing:
                raise
            await self.handle_exception(exc, action=None, request_id=None)

    async def handle_exception(self, exc, action, request_id):
        """想定外の例外では、後始末をしてから接続を閉じる。

        基底クラスは再送出するが、それだと ``disconnect`` が呼ばれず、在室者の行が
        alive のまま残る（一覧に幽霊が出て、ホストなら委譲もされない）。
        """
        if isinstance(exc, APIException | Http404):
            await super().handle_exception(exc, action=action, request_id=request_id)
            return
        if isinstance(exc, ValidationError):
            # 入力そのもの（ユーザー名など）はログへ出さない。
            logger.warning(
                "invalid %s message: %s",
                action,
                exc.errors(include_url=False, include_input=False),
            )
            code = CLOSE_POLICY_VIOLATION
        else:
            logger.error("unhandled error in action %s", action, exc_info=exc)
            code = CLOSE_INTERNAL_ERROR
        await self._abort(code)

    async def _abort(self, code: int) -> None:
        """退室の後始末をしてから、``code`` で接続を閉じる。以後のフレームは ``receive`` が捨てる。"""
        self._closing = True
        try:
            await self._leave()
        finally:
            await self.close(code=code)

    # --- action（クライアント → サーバ） ---------------------------------------

    @action()
    async def create(self, **payload):
        if self._room is not None:
            return
        request = CreateRequest.model_validate(payload)
        room, user = await repository.create_room(
            self.service,
            # 受信時はサービスの中で最も長い上限で切っているので、このサービスの列の長さへ切る。
            part_id=request.part_id[: self.service.part_id_max_length],
            title=request.title,
            user_name=request.user_name,
            user_icon=request.user_icon,
        )
        await self._enter(room, user)
        await self._reply(Create(room_id=room.room_id, user=_wire_user(user)))
        await self._broadcast_user_list(room)
        # 設定は既定値で作り、クライアントがこの後 update_setting で変える。
        await self._reply(self._setting)

    @action()
    async def join(self, **payload):
        if self._room is not None:
            return
        request = JoinRequest.model_validate(payload)
        room = await repository.get_alive_room(self.service, request.room_id)
        if room is None:
            await self._reply(ServerMessage(message_type="failed_join"))
            await self.close()
            return
        _cancel_pending_room_delete(_group_of(room))
        user = await repository.add_user(
            room, user_name=request.user_name, user_icon=request.user_icon
        )
        await self._enter(room, user)
        wire_user = _wire_user(user)
        await self._reply(Join(room_id=room.room_id, user=wire_user))
        await self._broadcast(room, UserAdd(user=wire_user))
        await self._broadcast_user_list(room)
        self._setting = await repository.load_setting(room)
        await self._reply(self._setting)

    @action()
    async def spectate(self, **payload):
        """読み取り専用で参加する（タイマー画面用）。

        参加ユーザーを作らないので、人数・一覧・ホスト委譲・自動削除に影響しない。
        """
        if self._room is not None:
            return
        request = SpectateRequest.model_validate(payload)
        room = await repository.get_alive_room(self.service, request.room_id)
        if room is None:
            await self._reply(ServerMessage(message_type="failed_spectate"))
            await self.close()
            return
        await self._enter(room, None)
        # 最初の video_operation が届く前に表示できるよう、現在の作品を返す。
        await self._reply(
            SpectateAck(room_id=room.room_id, part_id=room.part_id, title=room.title)
        )

    @action()
    async def leave(self, **payload):
        # close の後に届いた配信で送信が落ちると disconnect が呼ばれないので、先に後始末する。
        await self._abort(CLOSE_NORMAL)

    @_member_action(VideoOperationRequest)
    async def video_operation(self, room, user, request: VideoOperationRequest):
        """送信元以外へ再生操作を配信する。"""
        await repository.refresh(user, room)
        if self._setting.one_way and not user.is_host:
            return
        part_id = request.option.part_id
        if (
            user.is_host
            and part_id != room.part_id
            and len(part_id) <= self.service.part_id_max_length
        ):
            await repository.update_part_id(room, part_id)
        await self._broadcast(
            room,
            VideoOperation(
                room_id=room.room_id,
                operation=request.operation,
                user=_wire_user(user),
                option=request.option,
                title=request.title,
            ),
        )

    @_member_action()
    async def sync_request(self, room, user):
        """ホストに現在の再生状態を問い合わせる。"""
        await self._broadcast(room, SyncRequest(user=_wire_user(user)), HostSend)

    @_member_action(SyncResponseRequest)
    async def sync_response(self, room, user, request: SyncResponseRequest):
        """sync_request の送り主（``to_user``）へホストの再生状態を返す。

        ホストだけが送れる。ゲストからも通すと、一方通行（``one_way``）のルームでも
        宛先を選んで他人の再生を動かせてしまう。
        """
        await repository.refresh(user)
        if not user.is_host:
            return
        await self._broadcast(
            room,
            SyncResponse(option=request.option),
            UserSend,
            to_user=request.to_user,
        )

    @_member_action(OperationNotificationRequest)
    async def operation_notification(
        self, room, user, request: OperationNotificationRequest
    ):
        # 一方通行ではゲストの操作を配らないので、その通知も配らない。
        if self._setting.one_way:
            await repository.refresh(user)
            if not user.is_host:
                return
        await self._broadcast(
            room,
            OperationNotification(
                room_id=room.room_id,
                operation=request.operation,
                user=_wire_user(user),
            ),
        )

    @_member_action(ReactionRequest)
    async def reaction(self, room, user, request: ReactionRequest):
        """配信し、既定のリアクション（``ReactionType``）だけを統計用に保存する。

        エクストラリアクション（Noto のコードポイント）は配信のみ。
        """
        # 送信者自身の画面には拡張機能が表示するので、ここでは捨てるだけでよい。
        if self._setting.disable_reaction or not request.is_valid:
            return
        await self._broadcast(
            room,
            Reaction(reaction_type=request.reaction_type, user=_wire_user(user)),
        )
        if request.reaction_type in ReactionType.__members__:
            await repository.create_reaction(room, ReactionType[request.reaction_type])

    @_member_action()
    async def user_list(self, room, user):
        await self._reply(UserList(user_list=await repository.list_users(room)))

    @_member_action()
    async def delete_room(self, room, user):
        """ホストだけが実行できる。全員へ ``room_deleted`` を送ってから削除する。"""
        await repository.refresh(user)
        if user.is_host:
            await self._close_room(room)

    @_member_action(RoomSetting)
    async def update_setting(self, room, user, request: RoomSetting):
        """ホストだけが実行できる。全員へ ``room_setting`` を配信する。"""
        await repository.refresh(user)
        if not user.is_host:
            return
        await repository.save_setting(room, request)
        self._setting = request
        await self._broadcast(room, request, SettingSend)

    # --- channel layer からの配信（``format.py`` の封筒の ``type``） ---------------

    # 閉じた後に届いた配信は送らない（close の後の send は ASGI サーバが例外にする）。

    async def room_send(self, data: dict):
        if self._closing:
            return
        await self.send_json(data["response"])

    async def setting_send(self, data: dict):
        if self._closing:
            return
        self._setting = RoomSetting.model_validate(data["response"])
        await self.send_json(data["response"])

    async def group_send(self, data: dict):
        if self._closing:
            return
        if self.channel_name != data["sender_channel_name"]:
            await self.send_json(data["response"])

    async def host_send(self, data: dict):
        if self._closing:
            return
        user = self._user
        if user is None or self.channel_name == data["sender_channel_name"]:
            return
        await repository.refresh(user)
        if user.is_host:
            await self.send_json(data["response"])

    async def user_send(self, data: dict):
        if self._closing:
            return
        user = self._user
        if user is None or self.channel_name == data["sender_channel_name"]:
            return
        if str(user.user_id) == str(data["to_user"]["user_id"]):
            await self.send_json(data["response"])

    # --- 内部 -----------------------------------------------------------------

    async def _reply(self, message: ResponseBaseFormat) -> None:
        await self.send_json(message.model_dump(mode="json"))

    async def _broadcast(
        self,
        room: BaseRoom,
        response: ResponseBaseFormat,
        envelope: type[BaseGroupSend] = GroupSend,
        **extra,
    ) -> None:
        message = envelope(
            response=response, sender_channel_name=self.channel_name, **extra
        )
        await self.channel_layer.group_send(
            _group_of(room), message.model_dump(mode="json")
        )

    async def _broadcast_user_list(self, room: BaseRoom) -> None:
        users = await repository.list_users(room)
        await self._broadcast(room, UserList(user_list=users), RoomSend)

    async def _enter(self, room: BaseRoom, user: BaseUser | None) -> None:
        self._room, self._user = room, user
        await self.channel_layer.group_add(_group_of(room), self.channel_name)

    async def _close_room(self, room: BaseRoom) -> None:
        _cancel_pending_room_delete(_group_of(room))
        await self._broadcast(
            room, ServerMessage(message_type="room_deleted"), RoomSend
        )
        await repository.close_room(room)

    async def _leave(self) -> None:
        """退室の後始末。例外処理と ``disconnect`` の両方から呼ばれても 1 回しか走らない。"""
        room, user = self._room, self._user
        self._room = self._user = None
        if room is None:
            return
        await self.channel_layer.group_discard(_group_of(room), self.channel_name)
        if user is None:
            return

        # 委譲されたまま何も送っていない接続は、手元の is_host が古い。
        await repository.refresh(user)
        remaining = await repository.remove_user(room, user)
        if user.is_host and self._setting.owner_leave_delete:
            await self._close_room(room)
            return
        if remaining == 0:
            _schedule_room_delete(self.service, _group_of(room))
        elif user.is_host and await repository.promote_next_host(room):
            await self._broadcast(
                room, ServerMessage(message_type="host_change"), HostSend
            )
        await self._broadcast(room, Leave(user=_wire_user(user)))
        await self._broadcast_user_list(room)


class AnimePartyConsumer(BasePartyConsumer):
    """dアニメストアの同時視聴。WS: ``anime-store/party/``。"""

    service = ANIME_STORE


class DmmPartyConsumer(BasePartyConsumer):
    """DMM TV の同時視聴。WS: ``dmm-tv/party/``。"""

    service = DMM_TV
