"""A connection that is already in a room ignores further create/join/spectate."""

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator

from .consumers import AnimePartyConsumer
from .factories import AnimeRoomFactory
from .models import AnimeRoom, AnimeUser


async def _connect() -> WebsocketCommunicator:
    communicator = WebsocketCommunicator(
        AnimePartyConsumer.as_asgi(), "/anime-store/party/"
    )
    connected, _ = await communicator.connect()
    assert connected
    return communicator


@database_sync_to_async
def _counts() -> tuple[int, int]:
    return AnimeRoom.objects.count(), AnimeUser.objects.alive().count()


@pytest.mark.django_db(transaction=True)
async def test_second_create_is_ignored():
    communicator = await _connect()
    create = {"action": "create", "user_name": "a", "part_id": "1", "request_id": 1}
    await communicator.send_json_to(create)
    for _ in range(3):  # create, user_list, room_setting
        await communicator.receive_json_from()
    before = await _counts()

    await communicator.send_json_to(create)
    assert await communicator.receive_nothing()
    assert await _counts() == before
    await communicator.disconnect()


@pytest.mark.django_db(transaction=True)
async def test_join_after_spectate_is_ignored():
    room = await database_sync_to_async(AnimeRoomFactory)()
    communicator = await _connect()
    await communicator.send_json_to(
        {"action": "spectate", "room_id": str(room.room_id), "request_id": 1}
    )
    assert (await communicator.receive_json_from())["action"] == "spectate"
    before = await _counts()

    await communicator.send_json_to(
        {
            "action": "join",
            "room_id": str(room.room_id),
            "user_name": "a",
            "request_id": 2,
        }
    )
    assert await communicator.receive_nothing()
    assert await _counts() == before
    await communicator.disconnect()
