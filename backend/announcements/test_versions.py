"""拡張機能のバージョン（``x.y.z``）の解釈と、整数で持つフィールドのテスト。"""

import pytest
from django import forms
from django.core.exceptions import ValidationError

from . import versions
from .versions import ExtensionVersionField

# 形の合わない値。API の 400 と管理画面のフォームエラーのテストでも使う。
INVALID_VERSIONS = [
    "",
    "2",
    "2.1",
    "2.1.0.0",
    "v2.1.0",
    "2.1.0-beta",
    "2.1.0 ",
    " 2.1.0",
    "2.1.0\n",
    "2..0",
    "2.01.0",
    "-1.0.0",
    "65536.0.0",
    "0.0.99999",
    "２.１.０",  # 全角の数字
    "1" * 1000,
    "1." * 500 + "0",
]


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("0.0.0", (0, 0, 0)),
        ("2.14.1", (2, 14, 1)),
        ("65535.65535.65535", (65535, 65535, 65535)),
    ],
)
def test_parse(value, expected):
    assert versions.parse(value) == expected


@pytest.mark.parametrize("value", [*INVALID_VERSIONS, None, 2])
def test_parse_rejects(value):
    assert versions.parse(value) is None


def test_max_length_fits_the_longest_version():
    assert len("65535.65535.65535") == versions.MAX_LENGTH


def test_encode_orders_numerically():
    # 文字列で比べると "2.10.0" < "2.9.0" になってしまう。
    assert versions.encode("2.10.0") > versions.encode("2.9.0")
    assert versions.encode("10.0.0") > versions.encode("9.65535.65535")
    assert versions.encode("2.9.10") > versions.encode("2.9.9")


@pytest.mark.parametrize("value", ["0.0.0", "2.15.0", "65535.65535.65535"])
def test_decode_reverses_encode(value):
    assert versions.decode(versions.encode(value)) == value


def test_encode_rejects_invalid():
    with pytest.raises(ValueError, match="x.y.z"):
        versions.encode("2.1")


@pytest.mark.parametrize(
    ("value", "expected"),
    [(None, None), ("", None), ("2.15.0", "2.15.0"), (200015_00000, "2.15.0")],
)
def test_field_to_python(value, expected):
    assert ExtensionVersionField().to_python(value) == expected


def test_field_to_python_rejects_invalid():
    with pytest.raises(ValidationError) as excinfo:
        ExtensionVersionField().to_python("2.1")

    assert excinfo.value.messages == [versions.INVALID_VERSION]


def test_field_round_trips_through_the_database_value():
    field = ExtensionVersionField()

    assert field.get_prep_value(None) is None
    assert field.get_prep_value("") is None
    assert field.get_prep_value("2.15.0") == 200015_00000
    assert field.from_db_value(200015_00000, None, None) == "2.15.0"
    assert field.from_db_value(None, None, None) is None


def test_field_is_a_bigint_column_and_a_text_input():
    field = ExtensionVersionField(null=True, blank=True)
    formfield = field.formfield()

    assert field.get_internal_type() == "BigIntegerField"
    assert isinstance(formfield, forms.CharField)
    assert formfield.max_length == versions.MAX_LENGTH
    assert formfield.clean("") is None


def test_required_field_has_no_empty_value_override():
    formfield = ExtensionVersionField().formfield()

    assert isinstance(formfield, forms.CharField)
    assert formfield.required
    assert formfield.empty_value == ""
