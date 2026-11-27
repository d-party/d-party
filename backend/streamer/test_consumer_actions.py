"""``AnimePartyConsumer`` のうち ``tests.py`` が触れていないアクションのテスト。

sync_request / sync_response / operation_notification / user_list / leave と、
入室前のアクション・ホスト委譲・無人ルームの猶予つき削除を扱う。
"""

import asyncio
import uuid

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator

from . import consumers, repository
from .consumers import AnimePartyConsumer
from .factories import AnimeRoomFactory, AnimeUserFactory
from .format import OPERATION_MAX_LENGTH
from .models import AnimeReaction, AnimeRoom, AnimeUser, ReactionStat, ReactionType

pytestmark = pytest.mark.django_db(transaction=True)

OPTION = {"time": 12.5, "src": "blob:x", "paused": False, "rate": 1, "part_id": "1"}


@pytest.fixture(autouse=True)
def forget_pending_room_deletes():
    """猶予つき削除の予約はプロセス全体で持つので、テストをまたいで残さない。"""
    yield
    consumers._pending_room_deletes.clear()


async def _connect() -> WebsocketCommunicator:
    communicator = WebsocketCommunicator(
        AnimePartyConsumer.as_asgi(), "/anime-store/party/"
    )
    connected, _ = await communicator.connect()
    assert connected
    return communicator


async def _drain(communicator) -> list[dict]:
    messages = []
    while not await communicator.receive_nothing():
        messages.append(await communicator.receive_json_from())
    return messages


async def _recv_until(communicator, action: str) -> dict:
    while True:
        message = await communicator.receive_json_from()
        if message["action"] == action:
            return message


async def _create(communicator, user_name: str = "host") -> dict:
    await communicator.send_json_to(
        {"action": "create", "user_name": user_name, "part_id": "1", "request_id": 1}
    )
    created = await _recv_until(communicator, "create")
    await _drain(communicator)
    return created


async def _join(communicator, room_id: str, user_name: str) -> dict:
    await communicator.send_json_to(
        {
            "action": "join",
            "room_id": room_id,
            "user_name": user_name,
            "request_id": 1,
        }
    )
    joined = await _recv_until(communicator, "join")
    await _drain(communicator)
    return joined


async def _room_with_guests(*guest_names: str):
    """ホストと ``guest_names`` のゲストが入ったルームを作る。受信待ちは空にして返す。"""
    host = await _connect()
    created = await _create(host)
    guests = []
    for name in guest_names:
        guest = await _connect()
        joined = await _join(guest, created["room_id"], name)
        guests.append((guest, joined["user"]))
    for communicator in [host, *(guest for guest, _ in guests)]:
        await _drain(communicator)
    return host, created, guests


@database_sync_to_async
def _is_alive(model, pk) -> bool:
    return model.objects.alive().filter(pk=pk).exists()


@pytest.mark.parametrize(
    "message",
    [
        {"action": "video_operation", "operation": "playing", "option": OPTION},
        {"action": "sync_request"},
        {
            "action": "sync_response",
            "to_user": {"user_id": str(uuid.uuid4()), "user_name": "a"},
            "option": OPTION,
        },
        {"action": "operation_notification", "operation": "seeked"},
        {"action": "reaction", "reaction_type": "smile"},
        {"action": "user_list"},
        {"action": "delete_room"},
        {"action": "update_setting", "one_way": True},
    ],
    ids=lambda message: message["action"],
)
async def test_actions_before_entering_a_room_are_ignored(message):
    communicator = await _connect()

    await communicator.send_json_to({**message, "request_id": 1})

    assert await communicator.receive_nothing()
    assert not await database_sync_to_async(AnimeRoom.objects.exists)()
    assert not await database_sync_to_async(AnimeReaction.objects.exists)()
    await communicator.disconnect()


async def test_join_with_malformed_room_id_fails():
    communicator = await _connect()

    await communicator.send_json_to(
        {
            "action": "join",
            "room_id": "not-a-uuid",
            "user_name": "a",
            "request_id": 1,
        }
    )

    message = await communicator.receive_json_from()
    assert message == {"action": "server_message", "message_type": "failed_join"}
    assert (await communicator.receive_output())["type"] == "websocket.close"
    assert not await database_sync_to_async(AnimeUser.objects.exists)()


async def test_join_to_closed_room_fails():
    room = await database_sync_to_async(AnimeRoomFactory)()
    await database_sync_to_async(room.delete)()
    communicator = await _connect()

    await communicator.send_json_to(
        {
            "action": "join",
            "room_id": str(room.room_id),
            "user_name": "a",
            "request_id": 1,
        }
    )

    message = await communicator.receive_json_from()
    assert message["message_type"] == "failed_join"


async def test_leave_closes_the_connection_and_removes_the_user():
    host, created, [(guest, guest_user)] = await _room_with_guests("guest")

    await guest.send_json_to({"action": "leave", "request_id": 2})
    assert (await guest.receive_output())["type"] == "websocket.close"
    await guest.disconnect()

    left = await _recv_until(host, "leave")
    assert left["user"]["user_id"] == guest_user["user_id"]
    user_list = await _recv_until(host, "user_list")
    assert [user["user_name"] for user in user_list["user_list"]] == ["host"]
    assert not await _is_alive(AnimeUser, guest_user["user_id"])
    assert await _is_alive(AnimeRoom, created["room_id"])
    await host.disconnect()


async def test_sync_request_reaches_only_the_host():
    host, _, [(asker, asker_user), (other, _)] = await _room_with_guests("a", "b")

    await asker.send_json_to({"action": "sync_request", "request_id": 2})

    request = await host.receive_json_from()
    assert request["action"] == "sync_request"
    assert request["user"]["user_id"] == asker_user["user_id"]
    assert await other.receive_nothing()
    assert await asker.receive_nothing()
    for communicator in (host, asker, other):
        await communicator.disconnect()


async def test_sync_response_reaches_only_the_addressed_user():
    host, created, [(asker, asker_user), (other, _)] = await _room_with_guests("a", "b")
    spectator = await _connect()
    await spectator.send_json_to(
        {"action": "spectate", "room_id": created["room_id"], "request_id": 1}
    )
    await _recv_until(spectator, "spectate")

    await host.send_json_to(
        {
            "action": "sync_response",
            "to_user": asker_user,
            "option": OPTION,
            "request_id": 2,
        }
    )

    response = await asker.receive_json_from()
    assert response == {
        "action": "sync_response",
        # 拡張機能は Python の repr の文字列と比べる。
        "option": {**OPTION, "paused": "False", "rate": "1"},
    }
    assert await other.receive_nothing()
    assert await host.receive_nothing()
    # 観覧の接続は AnimeUser を持たないので、宛先にならない。
    assert await spectator.receive_nothing()
    for communicator in (host, asker, other, spectator):
        await communicator.disconnect()


@pytest.mark.parametrize("one_way", [False, True], ids=["normal", "one_way"])
async def test_sync_response_from_a_guest_is_dropped(one_way):
    host, created, [(attacker, _), (victim, victim_user)] = await _room_with_guests(
        "a", "b"
    )
    if one_way:
        await host.send_json_to(
            {"action": "update_setting", "one_way": True, "request_id": 2}
        )
        for communicator in (host, attacker, victim):
            await _recv_until(communicator, "room_setting")

    # ほかのゲスト宛ても、ホスト宛ても届かない。
    for to_user in (victim_user, created["user"]):
        await attacker.send_json_to(
            {
                "action": "sync_response",
                "to_user": to_user,
                "option": OPTION,
                "request_id": 3,
            }
        )
    # 同じ接続のメッセージは順に処理されるので、後から送ったリアクションが先に届けば、
    # 上の sync_response は配られていない（時間で待つより確か）。
    await attacker.send_json_to(
        {"action": "reaction", "reaction_type": "smile", "request_id": 4}
    )

    for communicator in (victim, host):
        assert (await communicator.receive_json_from())["action"] == "reaction"
    for communicator in (host, attacker, victim):
        await communicator.disconnect()


async def test_sync_response_checks_the_stored_host_flag():
    """接続が持っている is_host ではなく、DB の値で判定する（委譲は別の接続が書く）。"""
    _, _, [(promoted, promoted_user), (asker, asker_user)] = await _room_with_guests(
        "a", "b"
    )
    await database_sync_to_async(
        AnimeUser.objects.filter(user_id=promoted_user["user_id"]).update
    )(is_host=True)

    await promoted.send_json_to(
        {
            "action": "sync_response",
            "to_user": asker_user,
            "option": OPTION,
            "request_id": 2,
        }
    )

    assert (await asker.receive_json_from())["action"] == "sync_response"
    for communicator in (promoted, asker):
        await communicator.disconnect()


async def test_operation_notification_from_a_guest_is_dropped_in_one_way():
    host, _, [(guest, _), (other, _)] = await _room_with_guests("a", "b")
    await host.send_json_to(
        {"action": "update_setting", "one_way": True, "request_id": 2}
    )
    for communicator in (host, guest, other):
        await _recv_until(communicator, "room_setting")

    await guest.send_json_to(
        {"action": "operation_notification", "operation": "paused", "request_id": 3}
    )
    await guest.send_json_to(
        {"action": "reaction", "reaction_type": "smile", "request_id": 4}
    )

    for communicator in (host, other):
        assert (await communicator.receive_json_from())["action"] == "reaction"
    # ホストの通知は一方通行でも届く。
    await host.send_json_to(
        {"action": "operation_notification", "operation": "paused", "request_id": 5}
    )
    assert (await other.receive_json_from())["action"] == "operation_notification"
    for communicator in (host, guest, other):
        await communicator.disconnect()


async def test_sync_response_from_a_promoted_host_is_delivered():
    host, _, [(successor, _), (asker, asker_user)] = await _room_with_guests("a", "b")
    await host.disconnect()
    await _recv_until(successor, "server_message")  # host_change
    await _drain(successor)
    await _drain(asker)

    await successor.send_json_to(
        {
            "action": "sync_response",
            "to_user": asker_user,
            "option": OPTION,
            "request_id": 2,
        }
    )

    response = await _recv_until(asker, "sync_response")
    assert response["option"]["part_id"] == OPTION["part_id"]
    for communicator in (successor, asker):
        await communicator.disconnect()


async def test_operation_notification_is_broadcast_to_the_others():
    host, created, [(guest, guest_user)] = await _room_with_guests("guest")

    await guest.send_json_to(
        {"action": "operation_notification", "operation": "x" * 100, "request_id": 2}
    )

    notification = await host.receive_json_from()
    assert notification == {
        "action": "operation_notification",
        "room_id": created["room_id"],
        "operation": "x" * OPERATION_MAX_LENGTH,
        "user": guest_user,
    }
    assert await guest.receive_nothing()
    for communicator in (host, guest):
        await communicator.disconnect()


async def test_user_list_is_returned_to_the_requester_only():
    host, _, [(guest, _)] = await _room_with_guests("guest")

    await guest.send_json_to({"action": "user_list", "request_id": 2})

    user_list = await guest.receive_json_from()
    assert user_list["action"] == "user_list"
    assert sorted(
        (user["user_name"], user["is_host"]) for user in user_list["user_list"]
    ) == [("guest", False), ("host", True)]
    assert await host.receive_nothing()
    for communicator in (host, guest):
        await communicator.disconnect()


async def test_host_leave_promotes_the_oldest_guest():
    host, _, [(first, first_user), (second, _)] = await _room_with_guests("a", "b")

    await host.disconnect()

    # host_change はホスト宛て。昇格した本人にだけ届く。
    changed = await _recv_until(first, "server_message")
    assert changed["message_type"] == "host_change"
    user_list = await _recv_until(first, "user_list")
    assert {user["user_id"]: user["is_host"] for user in user_list["user_list"]}[
        first_user["user_id"]
    ]
    assert [m for m in await _drain(second) if m["action"] == "server_message"] == []
    for communicator in (first, second):
        await communicator.disconnect()


async def test_host_leave_without_a_successor_still_announces_the_leave(monkeypatch):
    """人数を数えた直後に残りの全員が抜けた場合。昇格はせず、退室の通知は続ける。"""

    async def nobody(room):
        return False

    monkeypatch.setattr(repository, "promote_next_host", nobody)
    host, _, [(guest, _)] = await _room_with_guests("guest")

    await host.disconnect()

    actions = [message["action"] for message in await _drain(guest)]
    assert actions == ["leave", "user_list"]
    await guest.disconnect()


async def test_promote_next_host_picks_the_oldest_alive_user():
    room = await database_sync_to_async(AnimeRoomFactory)()
    gone = await database_sync_to_async(AnimeUserFactory)(room_id=room)
    await database_sync_to_async(gone.delete)()
    oldest = await database_sync_to_async(AnimeUserFactory)(room_id=room)
    await database_sync_to_async(AnimeUserFactory)(room_id=room)

    assert await repository.promote_next_host(room)

    hosts = await database_sync_to_async(
        lambda: list(AnimeUser.objects.filter(is_host=True))
    )()
    assert hosts == [oldest]


async def test_promote_next_host_reports_an_empty_room():
    room = await database_sync_to_async(AnimeRoomFactory)()

    assert not await repository.promote_next_host(room)


async def test_spectator_disconnect_leaves_the_room_untouched():
    host, created, _ = await _room_with_guests()
    spectator = await _connect()
    await spectator.send_json_to(
        {"action": "spectate", "room_id": created["room_id"], "request_id": 1}
    )
    await _recv_until(spectator, "spectate")

    await spectator.disconnect()

    # 観覧は AnimeUser を持たないので、退室の通知も人数の変化も無い。
    assert await host.receive_nothing()
    assert await _is_alive(AnimeRoom, created["room_id"])
    assert created["room_id"] not in consumers._pending_room_deletes
    await host.disconnect()


class TestRoomGracePeriod:
    """最後の 1 人が抜けたルームは、猶予のあとで空のままなら消す。"""

    async def test_empty_room_is_closed_and_its_reactions_folded(self):
        room = await database_sync_to_async(AnimeRoomFactory)()
        await database_sync_to_async(AnimeReaction.objects.create)(
            room_id=room, reaction_type="S"
        )

        assert await repository.close_room_if_empty(str(room.room_id))

        assert not await _is_alive(AnimeRoom, room.pk)
        assert not await database_sync_to_async(AnimeReaction.objects.exists)()
        stat = await database_sync_to_async(ReactionStat.objects.get)()
        assert (stat.reaction_type, stat.count) == ("S", 1)

    async def test_room_someone_came_back_to_is_kept(self):
        room = await database_sync_to_async(AnimeRoomFactory)()
        await database_sync_to_async(AnimeUserFactory)(room_id=room)

        assert not await repository.close_room_if_empty(str(room.room_id))

        assert await _is_alive(AnimeRoom, room.pk)

    async def test_room_already_closed_is_left_alone(self):
        room = await database_sync_to_async(AnimeRoomFactory)()
        await database_sync_to_async(room.delete)()
        closed_at = room.deleted_at

        assert not await repository.close_room_if_empty(str(room.room_id))

        stored = await database_sync_to_async(AnimeRoom.objects.get)(pk=room.pk)
        assert stored.deleted_at == closed_at

    async def test_scheduled_delete_runs_after_the_delay(self):
        room = await database_sync_to_async(AnimeRoomFactory)()
        room_id = str(room.room_id)

        consumers._schedule_room_delete(room_id, delay=0)
        await consumers._pending_room_deletes[room_id]

        assert not await _is_alive(AnimeRoom, room.pk)
        assert room_id not in consumers._pending_room_deletes

    async def test_cancelled_delete_keeps_the_room(self):
        room = await database_sync_to_async(AnimeRoomFactory)()
        room_id = str(room.room_id)
        consumers._schedule_room_delete(room_id, delay=0)
        task = consumers._pending_room_deletes[room_id]

        consumers._cancel_pending_room_delete(room_id)
        await asyncio.wait([task])

        assert room_id not in consumers._pending_room_deletes
        assert await _is_alive(AnimeRoom, room.pk)

    async def test_rescheduling_replaces_the_previous_task(self):
        room = await database_sync_to_async(AnimeRoomFactory)()
        room_id = str(room.room_id)
        consumers._schedule_room_delete(room_id)
        first = consumers._pending_room_deletes[room_id]

        consumers._schedule_room_delete(room_id)
        await asyncio.wait([first])

        assert first.cancelled() or first.done()
        assert consumers._pending_room_deletes[room_id] is not first
        consumers._cancel_pending_room_delete(room_id)

    async def test_last_leave_schedules_and_rejoin_cancels(self):
        host = await _connect()
        created = await _create(host)
        room_id = created["room_id"]

        await host.disconnect()
        assert room_id in consumers._pending_room_deletes

        guest = await _connect()
        await _join(guest, room_id, "guest")
        assert room_id not in consumers._pending_room_deletes
        assert await _is_alive(AnimeRoom, room_id)

        await guest.disconnect()
        consumers._cancel_pending_room_delete(room_id)


class TestVideoOperation:
    async def test_player_state_arrives_in_the_shape_the_extension_reads(self):
        """拡張機能は ``paused`` / ``rate`` を bool / number で送り、文字列で受け取る。"""
        host, created, [(guest, _)] = await _room_with_guests("guest")

        await host.send_json_to(
            {
                "action": "video_operation",
                "operation": "pause",
                "title": "第2話",
                "option": {
                    "time": 754.25,
                    "src": "blob:https://example/x",
                    "paused": True,
                    "rate": 1.5,
                    "part_id": "1",
                },
                "request_id": 2,
            }
        )

        assert await guest.receive_json_from() == {
            "action": "video_operation",
            "room_id": created["room_id"],
            "operation": "pause",
            "user": created["user"],
            "title": "第2話",
            "option": {
                "time": 754.25,
                "src": "blob:https://example/x",
                "paused": "True",
                "rate": "1.5",
                "part_id": "1",
            },
        }
        assert await host.receive_nothing()
        for communicator in (host, guest):
            await communicator.disconnect()

    @staticmethod
    async def _send_part_id(communicator, part_id: str) -> None:
        await communicator.send_json_to(
            {
                "action": "video_operation",
                "operation": "playing",
                "option": {**OPTION, "part_id": part_id},
                "request_id": 2,
            }
        )
        # 同じ接続のメッセージは順に処理されるので、応答が返れば上の処理は終わっている。
        await communicator.send_json_to({"action": "user_list", "request_id": 3})
        await _recv_until(communicator, "user_list")

    @staticmethod
    @database_sync_to_async
    def _stored_part_id(room_id: str) -> str:
        return AnimeRoom.objects.get(room_id=room_id).part_id

    async def test_host_moving_to_another_episode_moves_the_room(self):
        """あとから入る人（ロビーの転送先）は、ホストが今観ている話へ飛ぶ。"""
        host, created, [(guest, _)] = await _room_with_guests("guest")

        await self._send_part_id(host, "22222222")

        assert await self._stored_part_id(created["room_id"]) == "22222222"
        assert (await guest.receive_json_from())["option"]["part_id"] == "22222222"
        for communicator in (host, guest):
            await communicator.disconnect()

    async def test_guest_on_another_episode_does_not_move_the_room(self):
        host, created, [(guest, _)] = await _room_with_guests("guest")

        await self._send_part_id(guest, "33333333")

        assert await self._stored_part_id(created["room_id"]) == "1"
        for communicator in (host, guest):
            await communicator.disconnect()

    async def test_oversized_part_id_is_not_stored(self):
        host, created, _ = await _room_with_guests()

        await self._send_part_id(host, "9" * (consumers.PART_ID_MAX_LENGTH + 1))

        assert await self._stored_part_id(created["room_id"]) == "1"
        await host.disconnect()


@pytest.mark.parametrize("reaction", list(ReactionType))
async def test_default_reaction_is_stored_under_its_value(reaction):
    """拡張機能は名前（``fav`` など）で送り、DB と統計は値（``F`` など）で持つ。"""
    host, created, [(guest, guest_user)] = await _room_with_guests("guest")

    await guest.send_json_to(
        {"action": "reaction", "reaction_type": reaction.name, "request_id": 2}
    )

    assert await host.receive_json_from() == {
        "action": "reaction",
        "reaction_type": reaction.name,
        "user": guest_user,
    }
    # 送信者の画面には拡張機能が自分で表示するので、送り返さない。
    assert await guest.receive_nothing()
    stored = await database_sync_to_async(AnimeReaction.objects.get)()
    assert stored.reaction_type == reaction.value
    assert str(stored.room_id_id) == created["room_id"]
    for communicator in (host, guest):
        await communicator.disconnect()


class TestRoomSetting:
    @staticmethod
    async def _update(host, **setting) -> dict:
        await host.send_json_to(
            {"action": "update_setting", **setting, "request_id": 2}
        )
        return await _recv_until(host, "room_setting")

    async def test_update_is_pushed_to_everyone_in_the_room(self):
        host, _, [(guest, _)] = await _room_with_guests("guest")

        pushed_to_host = await self._update(host, one_way=True)

        expected = {
            "action": "room_setting",
            "one_way": True,
            "owner_leave_delete": False,
            "disable_reaction": False,
        }
        assert pushed_to_host == expected
        assert await guest.receive_json_from() == expected
        for communicator in (host, guest):
            await communicator.disconnect()

    async def test_newcomer_is_told_the_current_setting(self):
        host, created, _ = await _room_with_guests()
        await self._update(host, owner_leave_delete=True, disable_reaction=True)
        guest = await _connect()

        await guest.send_json_to(
            {
                "action": "join",
                "room_id": created["room_id"],
                "user_name": "guest",
                "request_id": 1,
            }
        )

        assert await _recv_until(guest, "room_setting") == {
            "action": "room_setting",
            "one_way": False,
            "owner_leave_delete": True,
            "disable_reaction": True,
        }
        for communicator in (host, guest):
            await communicator.disconnect()

    async def test_one_way_still_lets_guests_react_and_ask_for_sync(self):
        """one_way が止めるのは再生操作だけ。"""
        host, _, [(guest, _)] = await _room_with_guests("guest")
        await self._update(host, one_way=True)
        await _drain(guest)

        await guest.send_json_to(
            {"action": "reaction", "reaction_type": "smile", "request_id": 2}
        )
        await guest.send_json_to({"action": "sync_request", "request_id": 3})

        assert (await host.receive_json_from())["action"] == "reaction"
        assert (await host.receive_json_from())["action"] == "sync_request"
        assert await database_sync_to_async(AnimeReaction.objects.count)() == 1
        for communicator in (host, guest):
            await communicator.disconnect()


async def test_spectator_neither_keeps_the_room_open_nor_becomes_host():
    host, created, _ = await _room_with_guests()
    room_id = created["room_id"]
    spectator = await _connect()
    await spectator.send_json_to(
        {"action": "spectate", "room_id": room_id, "request_id": 1}
    )
    await _recv_until(spectator, "spectate")

    await host.disconnect()

    messages = await _drain(spectator)
    assert [message["action"] for message in messages] == ["leave", "user_list"]
    assert messages[1]["user_list"] == []
    # 観覧だけが残ったルームは無人として扱い、猶予のあとで閉じる。
    assert room_id in consumers._pending_room_deletes
    assert await repository.close_room_if_empty(room_id)
    await spectator.disconnect()
