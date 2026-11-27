"""ASGI エントリポイント（``asgi.py``）の WebSocket の Origin 検査のテスト。"""

import importlib

import pytest
from channels.testing import WebsocketCommunicator

import d_party.asgi


@pytest.fixture
def load_application(settings):
    """``asgi.py`` は import 時に settings を読むので、値を決めてから読み直す。"""
    settings.MY_DOMAIN = "d-party.example"
    settings.D_ANIME_STORE_DOMAIN = "animestore.example"

    def load(*, debug: bool):
        settings.DEBUG = debug
        return importlib.reload(d_party.asgi).application

    return load


async def _connects(application, origin: str | None, path="/anime-store/party/"):
    headers = [] if origin is None else [(b"origin", origin.encode())]
    communicator = WebsocketCommunicator(application, path, headers=headers)
    connected, _ = await communicator.connect()
    if connected:
        await communicator.disconnect()
    return connected


@pytest.mark.parametrize(
    "origin",
    [
        # 拡張機能（dアニメストアのページに注入される content script）。
        "https://animestore.example",
        # タイマー画面（フロントのオリジン）。
        "https://d-party.example",
        "https://www.d-party.example",
    ],
)
async def test_production_accepts_known_origins(load_application, origin):
    assert await _connects(load_application(debug=False), origin)


@pytest.mark.parametrize(
    "origin",
    [
        "https://evil.example",
        "https://sub.animestore.example",
        "https://animestore.example.evil.example",
        None,
    ],
)
async def test_production_rejects_other_origins(load_application, origin):
    assert not await _connects(load_application(debug=False), origin)


async def test_debug_accepts_any_origin(load_application):
    assert await _connects(load_application(debug=True), "http://localhost:3000")


async def test_unknown_websocket_path_is_not_routed(load_application):
    application = load_application(debug=False)

    with pytest.raises(ValueError, match="No route found"):
        await _connects(application, "https://d-party.example", path="/other/")
