"""壊れたフレームを受けた consumer が、退室の後始末をしてから接続を閉じることのテスト。

基底クラスは ``handle_action`` より前に例外を投げるので、``receive`` で受け止めないと
``disconnect`` が呼ばれず、在室者の行が alive のまま残る（幽霊の参加者）。
"""

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator

from . import consumers
from .consumers import (
    CLOSE_INTERNAL_ERROR,
    CLOSE_POLICY_VIOLATION,
    MAX_FRAME_LENGTH,
    AnimePartyConsumer,
)
from .models import AnimeRoom, AnimeUser

pytestmark = pytest.mark.django_db(transaction=True)

OPTION = {"time": 1.5, "src": None, "paused": False, "rate": 1, "part_id": "1"}


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


async def _recv_all(communicator, *actions: str) -> None:
    """``actions`` がすべて届くまで受け取る（届く順は channel layer しだい）。"""
    pending = set(actions)
    while pending:
        pending.discard((await communicator.receive_json_from())["action"])


@database_sync_to_async
def _is_alive(model, pk) -> bool:
    return model.objects.alive().filter(pk=pk).exists()


async def _room_with_guest():
    """ホストとゲストが入ったルーム。入室で届くメッセージは受け取り済みで返す。"""
    host = await _connect()
    await host.send_json_to(
        {"action": "create", "user_name": "host", "part_id": "1", "request_id": 1}
    )
    created = await _recv_until(host, "create")
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
    joined = await _recv_until(guest, "join")
    await _recv_all(guest, "user_list", "room_setting")
    await _recv_all(host, "user_add", "user_list")
    return host, created, guest, joined["user"]


MALFORMED_TEXT = {
    # 空のテキストフレームは WebsocketCommunicator.send_to で送れないので、生の ASGI で送る。
    "empty": "",
    "not_json": "not json",
    "array": "[1, 2]",
    "string": '"join"',
    "number": "1",
    # Python の json は 4300 桁を超える整数を ValueError にする。
    "huge_integer": "1" * 5000,
    "unterminated_nesting": "[" * 50_000,
    "oversized": '{"action": "user_list", "pad": "' + "a" * MAX_FRAME_LENGTH + '"}',
    # DCRF が handle_action(**content) に展開すると、引数の束縛で TypeError になる。
    "self_key": '{"action": "user_list", "self": 1}',
    # available_actions の検索で TypeError（unhashable）になる。
    "non_string_action": '{"action": {"a": 1}}',
}


@pytest.mark.parametrize("text", MALFORMED_TEXT.values(), ids=MALFORMED_TEXT.keys())
async def test_malformed_text_frame_removes_the_sender_and_closes(text):
    host, created, guest, guest_user = await _room_with_guest()

    await guest.send_input({"type": "websocket.receive", "text": text})

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


@pytest.mark.parametrize("time", ["NaN", "Infinity", "-Infinity", "1e999"])
async def test_non_finite_time_is_rejected_instead_of_relayed(time):
    """NaN / Infinity は送り直すと JSON にならず、受け手がフレームごと捨てる。"""
    host, _, guest, guest_user = await _room_with_guest()
    option = '{"time": %s, "src": null, "paused": false, "rate": 1, "part_id": "1"}'

    await guest.send_to(
        text_data='{"action": "video_operation", "operation": "seeked", '
        f'"option": {option % time}, "request_id": 2}}'
    )

    closed = await guest.receive_output()
    assert closed == {"type": "websocket.close", "code": CLOSE_POLICY_VIOLATION}
    # ホストに届くのは退室の知らせで、壊れた video_operation ではない。
    assert (await host.receive_json_from())["action"] == "leave"
    assert not await _is_alive(AnimeUser, guest_user["user_id"])
    await host.disconnect()


async def test_frames_after_the_close_are_ignored():
    """閉じた後に処理されたフレームで、二重に閉じたり退室し直したりしない。"""
    host, _, guest, _ = await _room_with_guest()

    await guest.send_to(text_data="not json")
    await guest.send_to(text_data="still not json")
    await guest.send_json_to({"action": "user_list", "request_id": 2})

    closed = await guest.receive_output()
    assert closed == {"type": "websocket.close", "code": CLOSE_POLICY_VIOLATION}
    assert await guest.receive_nothing()
    await _recv_until(host, "leave")
    await host.disconnect()


async def test_malformed_frame_before_entering_a_room_just_closes():
    communicator = await _connect()

    await communicator.send_to(text_data="not json")

    closed = await communicator.receive_output()
    assert closed == {"type": "websocket.close", "code": CLOSE_POLICY_VIOLATION}
    assert not await database_sync_to_async(AnimeUser.objects.exists)()


@pytest.mark.parametrize(
    "text",
    [
        '{"action": "user_list", "pad": "'
        + "a" * (MAX_FRAME_LENGTH - len('{"action": "user_list", "pad": ""}'))
        + '"}',
        # 上限の内側なら、深い入れ子でも普通のメッセージとして扱う。
        '{"action": "user_list", "pad": ' + "[" * 30_000 + "]" * 30_000 + "}",
    ],
    ids=["at_the_limit", "deep_nesting"],
)
async def test_valid_frames_within_the_limit_are_handled(text):
    host, _, guest, _ = await _room_with_guest()
    assert len(text) <= MAX_FRAME_LENGTH

    await guest.send_to(text_data=text)

    assert (await guest.receive_json_from())["action"] == "user_list"
    await host.disconnect()
    await guest.disconnect()


async def test_missing_action_keeps_the_connection():
    """action の無いメッセージは DCRF のエラー応答を返すだけで、切らない。"""
    host, _, guest, guest_user = await _room_with_guest()

    await guest.send_json_to({"request_id": 2})

    reply = await guest.receive_json_from()
    assert reply["errors"]
    assert await _is_alive(AnimeUser, guest_user["user_id"])
    await host.disconnect()
    await guest.disconnect()


async def test_an_exception_escaping_receive_json_still_cleans_up(monkeypatch):
    """上で弾けなかった例外も、受け皿の handle_exception を通って退室させる。"""
    host, _, guest, guest_user = await _room_with_guest()

    async def broken(self, content, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(AnimePartyConsumer, "receive_json", broken)
    await guest.send_json_to({"action": "user_list", "request_id": 2})

    closed = await guest.receive_output()
    assert closed == {"type": "websocket.close", "code": CLOSE_INTERNAL_ERROR}
    await _recv_until(host, "leave")
    assert not await _is_alive(AnimeUser, guest_user["user_id"])
    await host.disconnect()
