"""``format.py``（WebSocket の公開プロトコル）の直列化のテスト。"""

import uuid

import pytest
from pydantic import ValidationError

from .format import (
    OPTION_SRC_MAX_LENGTH,
    OPTION_VALUE_MAX_LENGTH,
    GroupSend,
    Option,
    User,
    UserAdd,
    UserSend,
    VideoOperation,
)

USER = {"user_id": uuid.uuid4(), "user_name": "a"}
OPTION = {"time": 1.5, "src": None, "paused": "False", "rate": "1", "part_id": "1"}


@pytest.mark.parametrize(
    ("value", "expected"),
    [(False, "False"), (True, "True"), (1.5, "1.5"), (2, "2"), ("False", "False")],
)
def test_option_stringifies_paused_and_rate(value, expected):
    """拡張機能は ``option["paused"] === "False"`` と Python の repr で比べる。"""
    option = Option(**{**OPTION, "paused": value, "rate": value})

    assert option.paused == expected
    assert option.rate == expected


def test_option_rejects_missing_paused():
    with pytest.raises(ValidationError):
        Option(**{**OPTION, "paused": None})


def test_user_defaults():
    user = User(**USER)

    assert user.user_icon == "FaRegUser"
    assert user.is_host is False


def test_group_send_keeps_subclass_fields_of_response():
    """``response`` は基底型で宣言しているが、サブクラスのフィールドも直列化する。"""
    message = GroupSend(response=UserAdd(user=USER), sender_channel_name="ch")

    dumped = message.model_dump(mode="json")

    assert dumped["type"] == "group_send"
    assert dumped["response"] == {
        "action": "user_add",
        "user": {
            "user_id": str(USER["user_id"]),
            "user_name": "a",
            "user_icon": "FaRegUser",
            "is_host": False,
        },
    }


def test_user_send_carries_the_recipient():
    message = UserSend(
        response=UserAdd(user=USER), sender_channel_name="ch", to_user=USER
    )

    dumped = message.model_dump(mode="json")

    assert dumped["type"] == "user_send"
    assert dumped["to_user"]["user_id"] == str(USER["user_id"])


def test_video_operation_title_is_optional():
    operation = VideoOperation(
        room_id=uuid.uuid4(), operation="playing", user=USER, option=OPTION
    )

    dumped = operation.model_dump(mode="json")

    assert dumped["action"] == "video_operation"
    assert dumped["title"] is None
    assert dumped["option"]["src"] is None


def test_option_clips_relayed_strings():
    option = Option(
        **{
            **OPTION,
            "src": "s" * 5000,
            "paused": "p" * 100,
            "rate": 1.5,
            "part_id": 12345,
        }
    )

    assert option.src == "s" * OPTION_SRC_MAX_LENGTH
    assert option.paused == "p" * OPTION_VALUE_MAX_LENGTH
    assert option.rate == "1.5"
    assert option.part_id == "12345"


def test_option_keeps_a_missing_src():
    assert Option(**OPTION).src is None
