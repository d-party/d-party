"""Pydantic models describing the WebSocket message protocol.

The wire format is part of the public contract shared with the Chrome extension
(``extension/src/domain/protocol.ts``) and the front-end, so field names,
``action`` values and nesting must not change.

Note: ``SerializeAsAny`` is required on the ``response`` field so that, under
pydantic v2, subclass-specific fields are kept when serializing a field typed
as the ``ResponseBaseFormat`` base class.
"""

from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, SerializeAsAny, field_validator

from .models import (
    DEFAULT_USER_ICON,
    DEFAULT_USER_NAME,
    PART_ID_MAX_LENGTH,
    TITLE_MAX_LENGTH,
    USER_ICON_MAX_LENGTH,
    USER_NAME_MAX_LENGTH,
)


class User(BaseModel):
    """A participant. ``user_icon`` is a react-icons (Font Awesome 6) key."""

    user_id: UUID
    user_name: str
    user_icon: str = DEFAULT_USER_ICON
    is_host: bool = False


class Option(BaseModel):
    """再生状態。"""

    time: float
    src: str | None
    paused: str
    rate: str
    part_id: str

    @field_validator("paused", "rate", mode="before")
    @classmethod
    def _coerce_to_str(cls, value):
        # The extension compares the Python repr (`option.paused === "False"`),
        # so bools and numbers are stringified with str().
        if value is None or isinstance(value, str):
            return value
        return str(value)


# --- クライアント → サーバ -------------------------------------------------------
# 余分なキー（``request_id`` や、古い拡張機能が送る ``user_id`` など）は無視する。
#
# 拡張機能側の入力制限は WebSocket を直接叩けば迂回できる。長すぎる文字列は弾かずに
# 切り詰め、DB の桁あふれ（接続断）と過大なブロードキャストを防ぐ。

# 永続化しない（配信するだけの）値の上限。
OPERATION_MAX_LENGTH = 32
REACTION_TYPE_MAX_LENGTH = 32


def _clipped(max_length: int, default: str = ""):
    """``max_length`` へ切り詰める。文字列でなければ ``default``。"""

    def clip(value: object) -> str:
        return value[:max_length] if isinstance(value, str) else default

    return BeforeValidator(clip)


PartId = Annotated[str, _clipped(PART_ID_MAX_LENGTH)]
Title = Annotated[str, _clipped(TITLE_MAX_LENGTH)]
UserName = Annotated[str, _clipped(USER_NAME_MAX_LENGTH, DEFAULT_USER_NAME)]
UserIcon = Annotated[str, _clipped(USER_ICON_MAX_LENGTH, DEFAULT_USER_ICON)]
Operation = Annotated[str, _clipped(OPERATION_MAX_LENGTH)]


class CreateRequest(BaseModel):
    part_id: PartId
    user_name: UserName
    user_icon: UserIcon = DEFAULT_USER_ICON
    title: Title = ""


class JoinRequest(BaseModel):
    # UUID でない値は検証エラーにせず、存在しないルームとして扱う。
    room_id: Any = None
    user_name: UserName
    user_icon: UserIcon = DEFAULT_USER_ICON


class SpectateRequest(BaseModel):
    room_id: Any = None


class VideoOperationRequest(BaseModel):
    operation: Operation
    option: Option
    title: Title | None = None


class SyncResponseRequest(BaseModel):
    to_user: User
    option: Option


class OperationNotificationRequest(BaseModel):
    operation: Operation


class ReactionRequest(BaseModel):
    # 文字列でない・長すぎるものは配信しない（consumer が捨てる）。
    reaction_type: Any = None

    @property
    def is_valid(self) -> bool:
        return (
            isinstance(self.reaction_type, str)
            and len(self.reaction_type) <= REACTION_TYPE_MAX_LENGTH
        )


# --- サーバ → クライアント -------------------------------------------------------


class ResponseBaseFormat(BaseModel):
    """Base class for outgoing messages; the client dispatches on ``action``."""

    action: str


class Join(ResponseBaseFormat):
    action: str = "join"
    room_id: UUID
    user: User


class Leave(ResponseBaseFormat):
    action: str = "leave"
    user: User


class Create(ResponseBaseFormat):
    action: str = "create"
    room_id: UUID
    user: User


class VideoOperation(ResponseBaseFormat):
    action: str = "video_operation"
    room_id: UUID
    operation: str
    user: User
    option: Option
    # タイマー画面がエピソードの切り替えに追従するために使う。
    title: str | None = None


class OperationNotification(ResponseBaseFormat):
    action: str = "operation_notification"
    room_id: UUID
    operation: str
    user: User


class Reaction(ResponseBaseFormat):
    action: str = "reaction"
    reaction_type: str
    # 拡張機能が「ユーザー名 : リアクション」を表示するために使う。
    user: User


class SyncRequest(ResponseBaseFormat):
    action: str = "sync_request"
    user: User


class SyncResponse(ResponseBaseFormat):
    action: str = "sync_response"
    option: Option


class UserAdd(ResponseBaseFormat):
    action: str = "user_add"
    user: User


class ServerMessage(ResponseBaseFormat):
    action: str = "server_message"
    message_type: Literal[
        "failed_join", "failed_spectate", "host_change", "room_deleted"
    ]


class UserList(ResponseBaseFormat):
    action: str = "user_list"
    user_list: list[User]


class SpectateAck(ResponseBaseFormat):
    """spectate への応答。最初の video_operation より前に現在の作品を伝える。"""

    action: str = "spectate"
    room_id: UUID
    part_id: str
    title: str = ""


class RoomSetting(ResponseBaseFormat):
    """ルーム設定。create / join のときは本人へ、更新されたら全員へ送る。

    ``update_setting`` の入力もこの形で、省いた項目は ``False`` になる。
    """

    action: str = "room_setting"
    one_way: bool = False
    owner_leave_delete: bool = False
    disable_reaction: bool = False


# --- channel layer の封筒 -------------------------------------------------------
# ``type`` が consumer のハンドラ名になる。


class BaseGroupSend(BaseModel):
    type: str
    sender_channel_name: str
    response: SerializeAsAny[ResponseBaseFormat]


class GroupSend(BaseGroupSend):
    """送信者以外へ。"""

    type: str = "group_send"


class RoomSend(BaseGroupSend):
    """送信者を含む全員へ。"""

    type: str = "room_send"


class HostSend(BaseGroupSend):
    """ホストだけへ。"""

    type: str = "host_send"


class UserSend(BaseGroupSend):
    """``to_user`` だけへ。"""

    type: str = "user_send"
    to_user: User


class SettingSend(BaseGroupSend):
    """全員へ。各 consumer が設定のキャッシュを更新できるよう専用ハンドラへ振り分ける。"""

    type: str = "setting_send"
