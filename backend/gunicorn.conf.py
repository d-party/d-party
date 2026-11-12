import multiprocessing

wsgi_app = "d_party.asgi:application"

bind = "0.0.0.0:8000"

# Helm では GUNICORN_CMD_ARGS の --workers で上書きする（values.django.gunicornWorkers）。
workers = multiprocessing.cpu_count() * 1 + 1

worker_class = "uvicorn_worker.UvicornWorker"

# 制御ソケットは $HOME に作ろうとするが、ホームの無い非 root ユーザーでは失敗するので切る。
control_socket_disable = True
