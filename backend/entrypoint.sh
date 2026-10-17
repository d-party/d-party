#!/bin/sh
set -e

# Reap any rooms/users left "alive" by an ungraceful shutdown of a *previous*
# process. WebSocket session state lives only in the Django process, so a hard
# crash leaves ghost rows that would keep inflating the /api/.../alive counts.
# This only closes rows whose updated_at is older than the staleness threshold
# (sessions are assumed to last less than that), so it is safe to run on every
# start even with multiple replicas.
python manage.py close_active_sessions || true

# exec でシェルをサーバに置き換える。sh が PID 1 のまま残ると SIGTERM が gunicorn へ
# 届かず、graceful 停止（各 WebSocket の disconnect → leave_party）が走らないまま
# 猶予切れで SIGKILL される。
if [ "$DEBUG" = "1" ]; then
    exec python manage.py runserver 0.0.0.0:8000
else
    # ASGI app served by gunicorn with the uvicorn worker (see gunicorn.conf.py).
    exec gunicorn
fi
