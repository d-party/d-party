#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""

import os
import sys

import dotenv


def main():
    # コンテナに渡された環境変数（compose の env_file / k8s の env）を優先し、
    # ファイルは不足分を補うだけにする。上書きすると、本番の SECRET_KEY 等が
    # 管理コマンドの実行時だけ開発用の値へ戻ってしまう。
    dotenv.load_dotenv("/env_files/.env.django", verbose=True)
    dotenv.load_dotenv("/env_files/.env.global", verbose=True)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "d_party.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
