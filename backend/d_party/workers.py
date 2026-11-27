"""gunicorn の worker。``gunicorn.conf.py`` の ``worker_class`` から使う。"""

from uvicorn_worker import UvicornWorker

# 1 メッセージの上限（バイト。permessage-deflate を展開した後の大きさ）。uvicorn の既定は
# 16 MiB で、圧縮すれば数 KB の送信が json.loads で数百 MB の Python オブジェクトになる。
# クライアントが送るメッセージはどれも 1 KB に満たない（長い文字列は format.py が切り詰める）。
WS_MAX_SIZE = 64 * 1024


class PartyUvicornWorker(UvicornWorker):
    CONFIG_KWARGS = {**UvicornWorker.CONFIG_KWARGS, "ws_max_size": WS_MAX_SIZE}
