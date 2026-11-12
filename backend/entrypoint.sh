#!/bin/sh
set -e

# 前のプロセスが落ちて残った alive の行を回収する（他レプリカの稼働中セッションは触らない）。
python manage.py close_active_sessions || true

# exec しないと sh が PID 1 に残って SIGTERM が届かず、graceful 停止しない。
if [ "$DEBUG" = "1" ]; then
    exec python manage.py runserver 0.0.0.0:8000
else
    exec gunicorn
fi
