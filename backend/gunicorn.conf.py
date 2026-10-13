import multiprocessing

wsgi_app = "d_party.asgi:application"

bind = "0.0.0.0:8000"

# Helm では GUNICORN_CMD_ARGS の --workers で上書きする（values.django.gunicornWorkers）。
workers = multiprocessing.cpu_count() * 1 + 1

# The in-tree uvicorn.workers.UvicornWorker is deprecated; use the maintained
# standalone uvicorn-worker package.
worker_class = "uvicorn_worker.UvicornWorker"

# 実行時管理用の制御ソケット（gunicornc）は使わない。既定の置き場所は $HOME 配下で、
# 非 root のユーザー（--no-create-home）では作れずエラーログが出るだけなので無効にする。
control_socket_disable = True
