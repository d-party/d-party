"""本文の上限を広げるマイグレーション（0003）のテスト。

既存の行（60 文字までの本文）をそのまま残し、URL を含む 500 文字の本文を入れられるようにする。
"""

import datetime

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

pytestmark = pytest.mark.django_db(transaction=True)

APP = "announcements"
BEFORE = [(APP, "0002_extension_version_range")]
AFTER = [(APP, "0003_message_links")]


def _migrate(targets):
    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate(targets)
    return executor.loader.project_state(targets).apps


def _message_max_length() -> int | None:
    with connection.cursor() as cursor:
        columns = connection.introspection.get_table_description(
            cursor, "announcements"
        )
    return next(column.display_size for column in columns if column.name == "message")


@pytest.fixture
def at_before():
    yield _migrate(BEFORE)
    # 後のテストのため、最新まで戻す。
    _migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())


def test_widens_the_message_column_and_keeps_rows(at_before):
    old_apps = at_before
    now = datetime.datetime(2026, 11, 30, tzinfo=datetime.UTC)
    old_apps.get_model(APP, "Announcement").objects.create(
        message="あ" * 60, starts_at=now, ends_at=now + datetime.timedelta(hours=1)
    )
    assert _message_max_length() == 60

    new_apps = _migrate(AFTER)

    assert _message_max_length() == 500
    model = new_apps.get_model(APP, "Announcement")
    assert model.objects.get().message == "あ" * 60
    long_message = "[あ](https://d-party.net/" + "a" * 470 + ")"
    model.objects.create(
        message=long_message, starts_at=now, ends_at=now + datetime.timedelta(hours=1)
    )
    assert model.objects.filter(message=long_message).exists()


def test_reverses_when_rows_fit(at_before):
    _migrate(AFTER)

    _migrate(BEFORE)

    assert _message_max_length() == 60
