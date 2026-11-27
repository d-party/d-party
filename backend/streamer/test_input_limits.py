"""Client-supplied strings are clipped to the model limits before persisting."""

import uuid

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator

from .consumers import AnimePartyConsumer
from .format import (
    OPTION_SRC_MAX_LENGTH,
    OPTION_VALUE_MAX_LENGTH,
    PART_ID_RECEIVE_MAX_LENGTH,
    SyncResponseRequest,
    UserRef,
)
from .models import (
    USER_ICON_MAX_LENGTH,
    USER_NAME_MAX_LENGTH,
    AnimeReaction,
    AnimeRoom,
    AnimeUser,
)


async def _connect() -> WebsocketCommunicator:
    communicator = WebsocketCommunicator(
        AnimePartyConsumer.as_asgi(), "/anime-store/party/"
    )
    connected, _ = await communicator.connect()
    assert connected
    return communicator


@database_sync_to_async
def _room(room_id: str) -> AnimeRoom:
    return AnimeRoom.objects.get(room_id=room_id)


@database_sync_to_async
def _user(user_id: str) -> AnimeUser:
    return AnimeUser.objects.get(user_id=user_id)


@database_sync_to_async
def _reaction_count() -> int:
    return AnimeReaction.objects.count()


@pytest.mark.django_db(transaction=True)
async def test_create_clips_oversized_fields():
    communicator = await _connect()
    await communicator.send_json_to(
        {
            "action": "create",
            "user_name": "n" * 1000,
            "user_icon": "i" * 1000,
            "part_id": "1" * 100,
            "title": "t" * 1000,
            "request_id": 1,
        }
    )
    response = await communicator.receive_json_from()
    assert response["action"] == "create"
    assert response["user"]["user_name"] == "n" * 20

    room = await _room(response["room_id"])
    assert room.part_id == "1" * 16
    assert room.title == "t" * 255
    user = await _user(response["user"]["user_id"])
    assert user.user_name == "n" * 20
    assert user.user_icon == "i" * 64
    await communicator.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_create_falls_back_for_non_string_fields():
    communicator = await _connect()
    await communicator.send_json_to(
        {
            "action": "create",
            "user_name": {"nested": True},
            "user_icon": 123,
            "part_id": "123456",
            "request_id": 1,
        }
    )
    response = await communicator.receive_json_from()
    assert response["user"]["user_name"] == "user"
    assert response["user"]["user_icon"] == "FaRegUser"
    await communicator.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_oversized_reaction_type_is_dropped():
    host = await _connect()
    await host.send_json_to(
        {"action": "create", "user_name": "host", "part_id": "1", "request_id": 1}
    )
    await host.receive_json_from()  # create
    await host.receive_json_from()  # user_list
    await host.receive_json_from()  # room_setting
    before = await _reaction_count()

    await host.send_json_to(
        {"action": "reaction", "reaction_type": "x" * 1000, "request_id": 2}
    )
    assert await host.receive_nothing()
    assert await _reaction_count() == before
    await host.disconnect()


async def _room_with_guest():
    host = await _connect()
    await host.send_json_to(
        {"action": "create", "user_name": "host", "part_id": "1", "request_id": 1}
    )
    created = await host.receive_json_from()  # create
    await _recv_all(host, "user_list", "room_setting")
    guest = await _connect()
    await guest.send_json_to(
        {
            "action": "join",
            "room_id": created["room_id"],
            "user_name": "guest",
            "request_id": 1,
        }
    )
    joined = await guest.receive_json_from()  # join
    await _recv_all(guest, "user_list", "room_setting")
    await _recv_all(host, "user_add", "user_list")
    return host, created, guest, joined["user"]


async def _recv_all(communicator, *actions: str) -> None:
    """``actions`` がすべて届くまで受け取る（channel layer 経由のものは順が決まらない）。"""
    pending = set(actions)
    while pending:
        pending.discard((await communicator.receive_json_from())["action"])


OVERSIZED_OPTION = {
    "time": 1,
    "src": "s" * 10_000,
    "paused": "p" * 1000,
    "rate": "r" * 1000,
    "part_id": "9" * 1000,
}


@pytest.mark.django_db(transaction=True)
async def test_video_operation_clips_the_relayed_option():
    host, created, guest, _ = await _room_with_guest()

    await host.send_json_to(
        {
            "action": "video_operation",
            "operation": "seeked",
            "option": OVERSIZED_OPTION,
            "request_id": 2,
        }
    )

    relayed = (await guest.receive_json_from())["option"]
    assert relayed["src"] == "s" * OPTION_SRC_MAX_LENGTH
    assert relayed["paused"] == "p" * OPTION_VALUE_MAX_LENGTH
    assert relayed["rate"] == "r" * OPTION_VALUE_MAX_LENGTH
    assert relayed["part_id"] == "9" * PART_ID_RECEIVE_MAX_LENGTH
    # 保存できる長さを超える part_id は、ホストのものでも保存しない。
    room = await _room(created["room_id"])
    assert room.part_id == "1"
    await host.disconnect()
    await guest.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_sync_response_clips_the_addressee_and_the_option(monkeypatch):
    host, _, guest, guest_user = await _room_with_guest()
    # 宛先は封筒（channel layer のメッセージ）にだけ載り、受け手には届かないので、送る側で見る。
    envelopes = []
    broadcast = AnimePartyConsumer._broadcast

    async def spy(self, room, response, envelope=None, **extra):
        envelopes.append(extra)
        if envelope is None:
            return await broadcast(self, room, response, **extra)
        return await broadcast(self, room, response, envelope, **extra)

    monkeypatch.setattr(AnimePartyConsumer, "_broadcast", spy)

    await host.send_json_to(
        {
            "action": "sync_response",
            "to_user": {
                "user_id": guest_user["user_id"],
                "user_name": "n" * 10_000,
                "user_icon": "i" * 10_000,
            },
            "option": OVERSIZED_OPTION,
            "request_id": 2,
        }
    )

    # 宛先は user_id で照合するので、名前を切り詰めても届く。
    response = await guest.receive_json_from()
    assert response["action"] == "sync_response"
    assert response["option"]["src"] == "s" * OPTION_SRC_MAX_LENGTH
    (to_user,) = [extra["to_user"] for extra in envelopes if "to_user" in extra]
    assert to_user.user_name == "n" * USER_NAME_MAX_LENGTH
    assert to_user.user_icon == "i" * USER_ICON_MAX_LENGTH
    await host.disconnect()
    await guest.disconnect()


def test_user_ref_clips_names_like_the_request_models():
    ref = UserRef(user_id=uuid.uuid4(), user_name="n" * 1000, user_icon="i" * 1000)

    assert ref.user_name == "n" * USER_NAME_MAX_LENGTH
    assert ref.user_icon == "i" * USER_ICON_MAX_LENGTH
    assert SyncResponseRequest.model_fields["to_user"].annotation is UserRef
