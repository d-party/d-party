import uuid

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.test import TransactionTestCase

from .consumers import AnimePartyConsumer
from .factories import AnimeRoomFactory, AnimeUserFactory
from .models import AnimeReaction, AnimeRoom, AnimeUser, ReactionStat, Setting


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
class TestAnimePartyConsumer(TransactionTestCase):
    def setUp(self):
        self.anime_room1 = AnimeRoomFactory()
        self.anime_room2 = AnimeRoomFactory()
        self.anime_user1 = AnimeUserFactory(room_id=self.anime_room1, is_host=True)
        self.anime_user2 = AnimeUserFactory(room_id=self.anime_room1, is_host=False)

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_anime_party_consumer_create_ok(self):
        communicator = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        connected, subprotocol = await communicator.connect()
        assert connected
        user_name1 = "user_name1"
        user_icon1 = "FaCat"
        title1 = "鬼滅の刃 - 第1話 - 残酷"
        await communicator.send_json_to(
            {
                "action": "create",
                "user_name": user_name1,
                "user_icon": user_icon1,
                "part_id": "123456",
                "title": title1,
                "request_id": 100,
            }
        )
        response = await communicator.receive_json_from()
        assert response["action"] == "create"
        assert response["user"]["user_name"] == user_name1
        assert response["user"]["user_icon"] == user_icon1
        assert await self.anime_user_exist(response["user"]["user_id"])
        assert await self.anime_room_exist(response["room_id"])
        room = await self.get_anime_room(response["room_id"])
        assert room.title == title1
        await communicator.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_anime_party_consumer_join_ok(self):
        communicator = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        connected, subprotocol = await communicator.connect()
        assert connected
        room_id = str(self.anime_room1.room_id)
        user_name = "user_name"
        await communicator.send_json_to(
            {
                "action": "join",
                "user_name": user_name,
                "room_id": room_id,
                "part_id": "123456",
                "request_id": 100,
            }
        )
        response = await communicator.receive_json_from()
        assert response["action"] == "join"
        assert await self.anime_user_exist(response["user"]["user_id"])
        # user_icon を省くと既定のアイコンになる。
        assert response["user"]["user_icon"] == "FaRegUser"
        await communicator.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_anime_party_consumer_join_ng(self):
        communicator = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        connected, subprotocol = await communicator.connect()
        assert connected
        user_name = "user_name"
        await communicator.send_json_to(
            {
                "action": "join",
                "user_name": user_name,
                "room_id": str(uuid.uuid4()),
                "part_id": "123456",
                "request_id": 100,
            }
        )
        response = await communicator.receive_json_from()
        assert response["action"] == "server_message"
        assert response["message_type"] == "failed_join"
        await communicator.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_anime_party_consumer_video_action(self):
        communicator1 = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await communicator1.connect()
        user_name1 = "user_name1"
        await communicator1.send_json_to(
            {
                "action": "create",
                "user_name": user_name1,
                "part_id": "123456",
                "request_id": 100,
            }
        )
        response = await communicator1.receive_json_from()
        join_room_id = response["room_id"]
        create_user = response["user"]
        communicator2 = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await communicator2.connect()
        user_name2 = "user_name2"
        await communicator2.send_json_to(
            {
                "action": "join",
                "user_name": user_name2,
                "room_id": join_room_id,
                "part_id": "123456",
                "request_id": 100,
            }
        )
        # user_list / room_setting を挟んで届くので、順序に依存せず待つ。
        user_add = await self._recv_until(communicator1, "user_add")
        assert user_add["user"]["user_name"] == user_name2
        user_list = await self._recv_until(communicator1, "user_list")
        while len(user_list["user_list"]) < 2:
            user_list = await self._recv_until(communicator1, "user_list")
        hosts = {u["user_name"]: u["is_host"] for u in user_list["user_list"]}
        assert hosts[user_name1] is True
        assert hosts[user_name2] is False
        icons = {u["user_name"]: u["user_icon"] for u in user_list["user_list"]}
        assert icons[user_name1] == "FaRegUser"
        assert icons[user_name2] == "FaRegUser"
        await communicator2.send_json_to(
            {
                "action": "video_operation",
                "operation": "playing",
                "option": {
                    "time": "1",
                    "src": "blob:https://anime.dmkt-sp.jp/xxxxxxxxxxxxxxxxxxx",
                    "paused": "False",
                    "rate": "1",
                    "part_id": "00000000",
                },
                "request_id": 100,
            }
        )
        video = await self._recv_until(communicator1, "video_operation")
        assert video["user"]["user_name"] == user_name2
        assert video["room_id"] == join_room_id
        await communicator1.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_anime_party_consumer_delete_room_ok(self):
        """delete_room で論理削除し、ホストを含む全員へ room_deleted を送る。"""
        host = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await host.connect()
        await host.send_json_to(
            {
                "action": "create",
                "user_name": "host_user",
                "part_id": "123456",
                "request_id": 100,
            }
        )
        create_response = await host.receive_json_from()
        room_id = create_response["room_id"]
        await host.receive_json_from()

        guest = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await guest.connect()
        await guest.send_json_to(
            {
                "action": "join",
                "user_name": "guest_user",
                "room_id": room_id,
                "request_id": 100,
            }
        )
        await guest.receive_json_from()
        await guest.receive_json_from()
        await host.receive_json_from()
        await host.receive_json_from()

        await host.send_json_to({"action": "delete_room", "request_id": 100})

        host_msg = await self._recv_until(host, "server_message")
        assert host_msg["message_type"] == "room_deleted"

        guest_msg = await self._recv_until(guest, "server_message")
        assert guest_msg["message_type"] == "room_deleted"

        assert await self.room_alive(room_id) is False
        assert await self.alive_user_count(room_id) == 0

        # 両方切ると猶予削除タスクがテスト終了後に DB を触るので、片方だけ切る。
        await host.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_anime_party_consumer_delete_room_non_host_ignored(self):
        """ホスト以外の delete_room は無視する。"""
        host = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await host.connect()
        await host.send_json_to(
            {
                "action": "create",
                "user_name": "host_user",
                "part_id": "123456",
                "request_id": 100,
            }
        )
        create_response = await host.receive_json_from()
        room_id = create_response["room_id"]
        await host.receive_json_from()

        guest = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await guest.connect()
        await guest.send_json_to(
            {
                "action": "join",
                "user_name": "guest_user",
                "room_id": room_id,
                "request_id": 100,
            }
        )
        await guest.receive_json_from()
        await guest.receive_json_from()
        await host.receive_json_from()
        await host.receive_json_from()

        await self._drain(guest)
        await guest.send_json_to({"action": "delete_room", "request_id": 100})

        assert await guest.receive_nothing() is True
        assert await self.room_alive(room_id) is True
        assert await self.alive_user_count(room_id) == 2

        # 両方切ると猶予削除タスクがテスト終了後に DB を触るので、片方だけ切る。
        await host.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_delete_room_folds_reactions_into_stats(self):
        """delete_room でリアクションを ReactionStat へ畳み込み、元の行を消す。"""
        host = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await host.connect()
        await host.send_json_to(
            {
                "action": "create",
                "user_name": "host_user",
                "part_id": "123456",
                "request_id": 100,
            }
        )
        create_response = await host.receive_json_from()
        room_id = create_response["room_id"]
        await host.receive_json_from()  # create 直後の user_list を読み飛ばす。

        # 他テストの ReactionStat が残りうるので差分で見る。
        baseline = await self.smile_stat_total()

        await host.send_json_to(
            {"action": "reaction", "reaction_type": "smile", "request_id": 100}
        )
        await host.send_json_to(
            {"action": "reaction", "reaction_type": "smile", "request_id": 100}
        )

        # room_deleted を待てば畳み込みは終わっている。
        await host.send_json_to({"action": "delete_room", "request_id": 100})
        host_msg = await self._recv_until(host, "server_message")
        assert host_msg["message_type"] == "room_deleted"

        assert await self.reaction_rows(room_id) == 0
        assert await self.smile_stat_total() - baseline == 2

        await host.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_extra_reaction_broadcasts_but_is_not_persisted(self):
        """エクストラリアクションは配信するが保存しない。"""
        host = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await host.connect()
        await host.send_json_to(
            {
                "action": "create",
                "user_name": "host_user",
                "part_id": "123456",
                "request_id": 100,
            }
        )
        create_response = await host.receive_json_from()
        room_id = create_response["room_id"]
        await host.receive_json_from()  # create 直後の user_list を読み飛ばす。

        guest = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await guest.connect()
        await guest.send_json_to(
            {
                "action": "join",
                "user_name": "guest_user",
                "room_id": room_id,
                "part_id": "123456",
                "request_id": 100,
            }
        )
        extra_id = "1f600"
        await guest.send_json_to(
            {"action": "reaction", "reaction_type": extra_id, "request_id": 100}
        )

        msg = await host.receive_json_from()
        while msg["action"] != "reaction":
            msg = await host.receive_json_from()
        assert msg["reaction_type"] == extra_id
        assert msg["user"]["user_name"] == "guest_user"

        assert await self.reaction_rows(room_id) == 0

        await guest.disconnect()
        await host.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_spectate_receives_video_operation_with_title(self):
        """spectate は video_operation を受け取れるが、人数・一覧には出ない。"""
        host = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await host.connect()
        await host.send_json_to(
            {
                "action": "create",
                "user_name": "host_user",
                "part_id": "123456",
                "title": "第1話",
                "request_id": 100,
            }
        )
        create = await self._recv_until(host, "create")
        room_id = create["room_id"]

        spectator = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await spectator.connect()
        await spectator.send_json_to(
            {"action": "spectate", "room_id": room_id, "request_id": 100}
        )
        ack = await self._recv_until(spectator, "spectate")
        assert ack["room_id"] == room_id
        assert ack["part_id"] == "123456"
        assert ack["title"] == "第1話"

        await host.send_json_to(
            {
                "action": "video_operation",
                "operation": "playing",
                "title": "第2話",
                "option": {
                    "time": "12",
                    "src": "blob:x",
                    "paused": "False",
                    "rate": "1",
                    "part_id": "222222",
                },
                "request_id": 100,
            }
        )
        vop = await self._recv_until(spectator, "video_operation")
        assert vop["operation"] == "playing"
        assert vop["title"] == "第2話"
        assert vop["option"]["time"] == 12

        assert await self.alive_user_count(room_id) == 1

        await spectator.disconnect()
        await host.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_spectate_failed_for_missing_room(self):
        """存在しないルームを観覧しようとすると failed_spectate が返る。"""
        spectator = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await spectator.connect()
        await spectator.send_json_to(
            {"action": "spectate", "room_id": str(uuid.uuid4()), "request_id": 100}
        )
        msg = await self._recv_until(spectator, "server_message")
        assert msg["message_type"] == "failed_spectate"
        await spectator.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_spectate_survives_host_targeted_messages(self):
        """sync_request（HostSend）等が飛んでも観覧者はクラッシュしないテスト。

        観覧者は AnimeUser を持たないため、host_send ハンドラがガードされていないと
        renew_state で AttributeError → 1011 close となる。後続の video_operation を
        受信できることで接続の生存（＝クラッシュしていないこと）を確認する。"""
        host = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await host.connect()
        await host.send_json_to(
            {
                "action": "create",
                "user_name": "host_user",
                "part_id": "123456",
                "request_id": 100,
            }
        )
        create = await self._recv_until(host, "create")
        room_id = create["room_id"]

        spectator = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await spectator.connect()
        await spectator.send_json_to(
            {"action": "spectate", "room_id": room_id, "request_id": 100}
        )
        await self._recv_until(spectator, "spectate")

        # ホストが sync_request を投げる（HostSend が観覧者にも配送される）。
        await host.send_json_to({"action": "sync_request", "request_id": 100})
        # 直後に video_operation を送り、観覧者がまだ受信できる＝クラッシュしていない。
        await host.send_json_to(
            {
                "action": "video_operation",
                "operation": "playing",
                "option": {
                    "time": "1",
                    "src": "blob:x",
                    "paused": "False",
                    "rate": "1",
                    "part_id": "123456",
                },
                "request_id": 100,
            }
        )
        vop = await self._recv_until(spectator, "video_operation")
        assert vop["operation"] == "playing"

        await spectator.disconnect()
        await host.disconnect()

    async def _recv_until(self, communicator, action):
        """指定 action のメッセージが来るまで読み進めて返す（順序に依存しない検証用）。

        create/join では ``room_setting``（直接 send）と ``user_list``（channel layer 経由）の
        到達順が前後しうるため、特定 action を待つ検証はこのヘルパで順序非依存にする。
        """
        msg = await communicator.receive_json_from()
        while msg["action"] != action:
            msg = await communicator.receive_json_from()
        return msg

    async def _drain(self, communicator):
        while await communicator.receive_nothing() is False:
            await communicator.receive_json_from()

    async def _create_room(self, communicator, user_name="host_user"):
        await communicator.send_json_to(
            {
                "action": "create",
                "user_name": user_name,
                "part_id": "123456",
                "request_id": 100,
            }
        )
        create = await self._recv_until(communicator, "create")
        return create["room_id"]

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_create_auto_creates_and_pushes_default_setting(self):
        """create で Setting を既定値で作り、作成者へ room_setting を送る。"""
        host = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await host.connect()
        room_id = await self._create_room(host)
        setting_msg = await self._recv_until(host, "room_setting")
        assert setting_msg["one_way"] is False
        assert setting_msg["owner_leave_delete"] is False
        assert setting_msg["disable_reaction"] is False
        assert await self.setting_exists(room_id) is True
        await host.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_update_setting_owner_updates_and_broadcasts(self):
        """ホストの update_setting で DB を更新し、room_setting を配信する。"""
        host = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await host.connect()
        room_id = await self._create_room(host)
        await self._recv_until(host, "room_setting")

        await host.send_json_to(
            {
                "action": "update_setting",
                "one_way": True,
                "owner_leave_delete": False,
                "disable_reaction": True,
                "request_id": 100,
            }
        )
        updated = await self._recv_until(host, "room_setting")
        assert updated["one_way"] is True
        assert updated["disable_reaction"] is True

        setting = await self.get_setting(room_id)
        assert setting.one_way is True
        assert setting.disable_reaction is True
        await host.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_update_setting_non_host_ignored(self):
        """ホスト以外の update_setting は無視する。"""
        host = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await host.connect()
        room_id = await self._create_room(host)
        await self._recv_until(host, "room_setting")

        guest = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await guest.connect()
        await guest.send_json_to(
            {
                "action": "join",
                "user_name": "guest_user",
                "room_id": room_id,
                "request_id": 100,
            }
        )
        await self._recv_until(guest, "room_setting")
        await self._drain(guest)

        await guest.send_json_to(
            {"action": "update_setting", "one_way": True, "request_id": 100}
        )
        assert await guest.receive_nothing() is True
        setting = await self.get_setting(room_id)
        assert setting.one_way is False

        await host.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_one_way_blocks_non_host_video_operation(self):
        """one_way ではホスト以外の video_operation を捨てる。"""
        host = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await host.connect()
        room_id = await self._create_room(host)
        await self._recv_until(host, "room_setting")
        await host.send_json_to(
            {"action": "update_setting", "one_way": True, "request_id": 100}
        )
        await self._recv_until(host, "room_setting")

        guest = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await guest.connect()
        await guest.send_json_to(
            {
                "action": "join",
                "user_name": "guest_user",
                "room_id": room_id,
                "request_id": 100,
            }
        )
        await self._recv_until(guest, "room_setting")
        while await host.receive_nothing() is False:
            await host.receive_json_from()

        await guest.send_json_to(
            {
                "action": "video_operation",
                "operation": "playing",
                "option": {
                    "time": "1",
                    "src": "blob:x",
                    "paused": "False",
                    "rate": "1",
                    "part_id": "00000000",
                },
                "request_id": 100,
            }
        )
        assert await host.receive_nothing() is True

        await host.send_json_to(
            {
                "action": "video_operation",
                "operation": "playing",
                "option": {
                    "time": "2",
                    "src": "blob:y",
                    "paused": "False",
                    "rate": "1",
                    "part_id": "123456",
                },
                "request_id": 100,
            }
        )
        vop = await self._recv_until(guest, "video_operation")
        assert vop["operation"] == "playing"

        await host.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_one_way_alone_does_not_delete_room_on_host_leave(self):
        """one_way だけではホストが抜けてもルームを消さない。"""
        host = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await host.connect()
        room_id = await self._create_room(host)
        await self._recv_until(host, "room_setting")
        await host.send_json_to(
            {"action": "update_setting", "one_way": True, "request_id": 100}
        )
        await self._recv_until(host, "room_setting")

        guest = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await guest.connect()
        await guest.send_json_to(
            {
                "action": "join",
                "user_name": "guest_user",
                "room_id": room_id,
                "request_id": 100,
            }
        )
        await self._recv_until(guest, "room_setting")

        await host.disconnect()

        while await guest.receive_nothing() is False:
            msg = await guest.receive_json_from()
            assert msg.get("message_type") != "room_deleted"
        assert await self.room_alive(room_id) is True
        assert await self.alive_user_count(room_id) == 1

        await guest.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_room_people_counts_follow_join_and_leave(self):
        """在室人数・累計参加人数が join / leave に追随するテスト。

        人数は AnimeRoom のカラムではなく AnimeUser から導出するため、退室しても
        累計（sum_people）は減らず、在室（num_people）だけが減る。
        """
        host = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await host.connect()
        room_id = await self._create_room(host)
        await self._recv_until(host, "room_setting")
        assert await self.room_people_counts(room_id) == (1, 1)

        guests = []
        for i in range(2):
            guest = WebsocketCommunicator(
                AnimePartyConsumer.as_asgi(), "/anime-store/party/"
            )
            await guest.connect()
            await guest.send_json_to(
                {
                    "action": "join",
                    "user_name": f"guest_user{i}",
                    "room_id": room_id,
                    "request_id": 100,
                }
            )
            await self._recv_until(guest, "room_setting")
            guests.append(guest)

        assert await self.room_people_counts(room_id) == (3, 3)

        await guests[0].disconnect()
        assert await self.room_people_counts(room_id) == (2, 3)

        await guests[1].disconnect()
        await host.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_disable_reaction_not_broadcast_or_persisted(self):
        """disable_reaction では配信も保存もしない。"""
        host = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await host.connect()
        room_id = await self._create_room(host)
        await self._recv_until(host, "room_setting")
        await host.send_json_to(
            {"action": "update_setting", "disable_reaction": True, "request_id": 100}
        )
        await self._recv_until(host, "room_setting")

        guest = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await guest.connect()
        await guest.send_json_to(
            {
                "action": "join",
                "user_name": "guest_user",
                "room_id": room_id,
                "request_id": 100,
            }
        )
        await self._recv_until(guest, "room_setting")
        while await host.receive_nothing() is False:
            await host.receive_json_from()

        await guest.send_json_to(
            {"action": "reaction", "reaction_type": "smile", "request_id": 100}
        )
        assert await host.receive_nothing() is True
        assert await self.reaction_rows(room_id) == 0

        await host.disconnect()

    @pytest.mark.django_db(transaction=True)
    @pytest.mark.asyncio
    async def test_owner_leave_delete_deletes_room_on_host_leave(self):
        """owner_leave_delete ならホストが抜けるとルームを消し、残りへ room_deleted を送る。"""
        host = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await host.connect()
        room_id = await self._create_room(host)
        await self._recv_until(host, "room_setting")
        await host.send_json_to(
            {
                "action": "update_setting",
                "owner_leave_delete": True,
                "request_id": 100,
            }
        )
        await self._recv_until(host, "room_setting")

        guest = WebsocketCommunicator(
            AnimePartyConsumer.as_asgi(), "/anime-store/party/"
        )
        await guest.connect()
        await guest.send_json_to(
            {
                "action": "join",
                "user_name": "guest_user",
                "room_id": room_id,
                "request_id": 100,
            }
        )
        await self._recv_until(guest, "room_setting")

        await host.disconnect()

        deleted = await self._recv_until(guest, "server_message")
        assert deleted["message_type"] == "room_deleted"
        assert await self.room_alive(room_id) is False
        assert await self.alive_user_count(room_id) == 0

        await guest.disconnect()

    @database_sync_to_async
    def setting_exists(self, room_id):
        return Setting.objects.filter(room_id=room_id).exists()

    @database_sync_to_async
    def get_setting(self, room_id):
        return Setting.objects.get(room_id=room_id)

    @database_sync_to_async
    def reaction_rows(self, room_id):
        return AnimeReaction.objects.filter(room_id=room_id).count()

    @database_sync_to_async
    def smile_stat_total(self):
        from django.db.models import Sum

        return (
            ReactionStat.objects.filter(reaction_type="S").aggregate(t=Sum("count"))[
                "t"
            ]
            or 0
        )

    @database_sync_to_async
    def room_alive(self, room_id):
        return AnimeRoom.objects.alive().filter(room_id=room_id).exists()

    @database_sync_to_async
    def alive_user_count(self, room_id):
        return AnimeUser.objects.alive().filter(room_id=room_id).count()

    @database_sync_to_async
    def room_people_counts(self, room_id):
        """``(在室人数, 累計参加人数)`` を AnimeUser から導出して返す。"""
        room = AnimeRoom.objects.with_people_counts().get(room_id=room_id)
        return (room.num_people, room.sum_people)

    @database_sync_to_async
    def anime_user_exist(self, user_id):
        return AnimeUser.objects.filter(user_id=user_id).exists()

    @database_sync_to_async
    def get_anime_user(self, user_id):
        return AnimeUser.objects.get(user_id=user_id)

    @database_sync_to_async
    def anime_room_exist(self, room_id):
        return AnimeRoom.objects.filter(room_id=room_id).exists()

    @database_sync_to_async
    def get_anime_room(self, room_id):
        return AnimeRoom.objects.get(room_id=room_id)
