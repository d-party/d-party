#!/bin/sh
set -e

# 前のプロセスが落ちて残った alive の行を回収する。updated_at が古い行だけを閉じる
# （セッションはそれより長く続かない前提）ので、複数レプリカでも毎回走らせてよい。
python manage.py close_active_sessions || true

# exec しないと sh が PID 1 に残って SIGTERM が届かず、graceful 停止しない。
if [ "$DEBUG" = "1" ]; then
    exec python manage.py runserver 0.0.0.0:8000
else
    exec gunicorn
fi
