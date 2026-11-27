"""壊れたフレームを受けた consumer が、退室の後始末をしてから接続を閉じることのテスト。

基底クラスは ``handle_action`` より前に例外を投げるので、``receive`` で受け止めないと
``disconnect`` が呼ばれず、在室者の行が alive のまま残る（幽霊の参加者）。
"""

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator

from . import consumers
from .consumers import CLOSE_POLICY_VIOLATION, MAX_FRAME_LENGTH, AnimePartyConsumer
from .models import AnimeRoom, AnimeUser

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def forget_pending_room_deletes():
    yield
    consumers._pending_room_deletes.clear()


async def _connect() -> WebsocketCommunicator:
    communicator = WebsocketCommunicator(
        AnimePartyConsumer.as_asgi(), "/anime-store/party/"
    )
    connected, _ = await communicator.connect()
    assert connected
    return communicator


async def _recv_until(communicator, action: str) -> dict:
    while True:
        message = await communicator.receive_json_from()
        if message["action"] == action:
            return message


async def _drain(communicator) -> None:
    while not await communicator.receive_nothing():
        await communicator.receive_output()


@database_sync_to_async
def _is_alive(model, pk) -> bool:
    return model.objects.alive().filter(pk=pk).exists()


async def _room_with_guest():
    host = await _connect()
    await host.send_json_to(
        {"action": "create", "user_name": "host", "part_id": "1", "request_id": 1}
    )
    created = await _recv_until(host, "create")
    guest = await _connect()
    await guest.send_json_to(
        {
            "action": "join",
            "room_id": created["room_id"],
            "user_name": "guest",
            "request_id": 1,
        }
    )
    joined = await _recv_until(guest, "join")
    await _drain(host)
    await _drain(guest)
    return host, created, guest, joined["user"]


MALFORMED_TEXT = {
    "not_json": "not json",
    "array": "[1, 2]",
    "string": '"join"',
    "number": "1",
    # Python の json は 4300 桁を超える整数を ValueError にする。
    "huge_integer": "1" * 5000,
    # 深すぎる入れ子は RecursionError になる。
    "deep_nesting": "[" * 50_000,
    "oversized": '{"action": "user_list", "pad": "' + "a" * MAX_FRAME_LENGTH + '"}',
}


@pytest.mark.parametrize("text", MALFORMED_TEXT.values(), ids=MALFORMED_TEXT.keys())
async def test_malformed_text_frame_removes_the_sender_and_closes(text):
    host, created, guest, guest_user = await _room_with_guest()

    await guest.send_to(text_data=text)

    closed = await guest.receive_output()
    assert closed == {"type": "websocket.close", "code": CLOSE_POLICY_VIOLATION}
    left = await _recv_until(host, "leave")
    assert left["user"]["user_id"] == guest_user["user_id"]
    user_list = await _recv_until(host, "user_list")
    assert [user["user_name"] for user in user_list["user_list"]] == ["host"]
    assert not await _is_alive(AnimeUser, guest_user["user_id"])
    assert await _is_alive(AnimeRoom, created["room_id"])
    await host.disconnect()


async def test_binary_frame_removes_the_sender_and_closes():
    host, _, guest, guest_user = await _room_with_guest()

    await guest.send_to(bytes_data=b"\x00\x01")

    closed = await guest.receive_output()
    assert closed == {"type": "websocket.close", "code": CLOSE_POLICY_VIOLATION}
    assert not await _is_alive(AnimeUser, guest_user["user_id"])
    await host.disconnect()


async def test_malformed_frame_before_entering_a_room_just_closes():
    communicator = await _connect()

    await communicator.send_to(text_data="not json")

    closed = await communicator.receive_output()
    assert closed == {"type": "websocket.close", "code": CLOSE_POLICY_VIOLATION}
    assert not await database_sync_to_async(AnimeUser.objects.exists)()


async def test_frame_at_the_limit_is_still_handled():
    host, _, guest, _ = await _room_with_guest()
    prefix = '{"action": "user_list", "pad": "'
    suffix = '"}'
    text = prefix + "a" * (MAX_FRAME_LENGTH - len(prefix) - len(suffix)) + suffix
    assert len(text) == MAX_FRAME_LENGTH

    await guest.send_to(text_data=text)

    user_list = await guest.receive_json_from()
    assert user_list["action"] == "user_list"
    await host.disconnect()
    await guest.disconnect()
