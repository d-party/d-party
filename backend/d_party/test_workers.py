"""gunicorn の worker（``d_party/workers.py``）のテスト。"""

import importlib.util
from pathlib import Path

import uvicorn
from uvicorn_worker import UvicornWorker

from .workers import WS_MAX_SIZE, PartyUvicornWorker


def test_worker_caps_websocket_messages():
    """uvicorn が実際に受け取る設定として効くこと（キーの綴りを含めて）。"""
    config = uvicorn.Config(app=None, **PartyUvicornWorker.CONFIG_KWARGS)

    assert config.ws_max_size == WS_MAX_SIZE == 64 * 1024


def test_worker_keeps_the_base_config():
    for key, value in UvicornWorker.CONFIG_KWARGS.items():
        assert PartyUvicornWorker.CONFIG_KWARGS[key] == value


def test_gunicorn_uses_the_worker():
    path = Path(__file__).resolve().parents[1] / "gunicorn.conf.py"
    spec = importlib.util.spec_from_file_location("gunicorn_conf", path)
    assert spec
    assert spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    assert module.worker_class == "d_party.workers.PartyUvicornWorker"
