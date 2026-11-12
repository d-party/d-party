"""Client-supplied strings are clipped to the model limits before persisting."""

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator

from .consumers import AnimePartyConsumer
from .models import AnimeReaction, AnimeRoom, AnimeUser


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
