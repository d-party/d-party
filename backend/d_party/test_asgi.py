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
    settings.DMM_TV_DOMAIN = "tv.dmm.example"

    def load(*, debug: bool):
        settings.DEBUG = debug
        return importlib.reload(d_party.asgi).application

    return load


ANIME_STORE_PATH = "/anime-store/party/"
DMM_TV_PATH = "/dmm-tv/party/"


async def _connects(application, origin: str | None, path=ANIME_STORE_PATH):
    headers = [] if origin is None else [(b"origin", origin.encode())]
    communicator = WebsocketCommunicator(application, path, headers=headers)
    connected, _ = await communicator.connect()
    if connected:
        await communicator.disconnect()
    return connected


@pytest.mark.parametrize(
    ("origin", "path"),
    [
        # 拡張機能（dアニメストアのページに注入される content script）。
        ("https://animestore.example", ANIME_STORE_PATH),
        # 拡張機能（DMM TV の再生ページに注入される content script）。
        ("https://tv.dmm.example", DMM_TV_PATH),
        # タイマー画面（フロントのオリジン）。
        ("https://d-party.example", ANIME_STORE_PATH),
        ("https://www.d-party.example", ANIME_STORE_PATH),
    ],
)
async def test_production_accepts_known_origins(load_application, origin, path):
    assert await _connects(load_application(debug=False), origin, path)


@pytest.mark.parametrize("path", [ANIME_STORE_PATH, DMM_TV_PATH])
@pytest.mark.parametrize(
    "origin",
    [
        "https://evil.example",
        "https://sub.animestore.example",
        "https://animestore.example.evil.example",
        "https://sub.tv.dmm.example",
        "https://tv.dmm.example.evil.example",
        # 実在のドメインでも、設定していないものは通さない。
        "https://www.dmm.example",
        None,
    ],
)
async def test_production_rejects_other_origins(load_application, origin, path):
    assert not await _connects(load_application(debug=False), origin, path)


async def test_production_accepts_the_real_dmm_tv_origin_by_default(settings):
    """既定（env 未設定）の ``DMM_TV_DOMAIN`` で、本番の DMM TV のページからつながる。"""
    settings.DEBUG = False
    application = importlib.reload(d_party.asgi).application

    assert await _connects(application, "https://tv.dmm.com", DMM_TV_PATH)


async def test_debug_accepts_any_origin(load_application):
    assert await _connects(load_application(debug=True), "http://localhost:3000")


async def test_unknown_websocket_path_is_not_routed(load_application):
    application = load_application(debug=False)

    with pytest.raises(ValueError, match="No route found"):
        await _connects(application, "https://d-party.example", path="/other/")
