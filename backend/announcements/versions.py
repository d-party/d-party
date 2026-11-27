"""拡張機能のバージョン（``x.y.z``）の解釈と、DB に整数で持つためのモデルのフィールド。

アナウンスの配信対象（下限・上限）を DB で絞り込むため、バージョンを「数値の順に並ぶ整数」に
直して 1 列で持つ。各部を 10 進 5 桁ずつに詰める（``2.15.0`` → ``2_00015_00000``）。
Chrome の manifest の各部は 0〜65535 なので 5 桁に収まり、整数の大小がそのままバージョンの
大小になる（``2.10.0`` > ``2.9.0``）。Python 側では ``x.y.z`` の文字列で扱う。
"""

import re
from typing import Any

from django import forms
from django.core.exceptions import ValidationError
from django.db import models

# Chrome の manifest の version と同じ規則（ただし数字 3 つに限る）。各部は 0〜65535 の整数で、
# 0 以外は 0 で始めない。OpenAPI の pattern にも使うので ECMAScript でも読める形にする。
PATTERN = r"^(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})\.(0|[1-9][0-9]{0,4})$"
COMPONENT_MAX = 65535
# ``65535.65535.65535`` の長さ。
MAX_LENGTH = 17

INVALID_VERSION = (
    "x.y.z の形（例: 2.15.0）で入力してください。各部は 0〜65535 の整数です。"
)

_VERSION_RE = re.compile(PATTERN)
_BASE = 100_000


def parse(value: object) -> tuple[int, int, int] | None:
    """``x.y.z`` を ``(x, y, z)`` に直す。形が合わなければ ``None``。"""
    # ``$`` は末尾の改行の前でも当たるので、fullmatch で文字列全体を見る。
    if not isinstance(value, str) or not (match := _VERSION_RE.fullmatch(value)):
        return None
    major, minor, patch = (int(part) for part in match.groups())
    if max(major, minor, patch) > COMPONENT_MAX:
        return None
    return major, minor, patch


def encode(value: str) -> int:
    """``x.y.z`` を数値の順に並ぶ整数に直す。形が合わなければ ``ValueError``。"""
    parts = parse(value)
    if parts is None:
        raise ValueError(f"not an x.y.z extension version: {value!r}")
    major, minor, patch = parts
    return (major * _BASE + minor) * _BASE + patch


def decode(number: int) -> str:
    """``encode`` の逆。"""
    rest, patch = divmod(number, _BASE)
    major, minor = divmod(rest, _BASE)
    return f"{major}.{minor}.{patch}"


class ExtensionVersionField(models.Field):
    """``x.y.z`` の文字列を ``bigint`` の 1 列で持つ。

    比較の lookup（``__lte`` · ``__gte`` など）に文字列を渡すと整数に直して DB で比べる。
    """

    description = "拡張機能のバージョン（x.y.z）"

    def get_internal_type(self) -> str:
        return "BigIntegerField"

    def from_db_value(self, value: int | None, expression: Any, connection: Any):
        return None if value is None else decode(value)

    def to_python(self, value: Any) -> str | None:
        if value is None or value == "":
            return None
        if isinstance(value, int):
            return decode(value)
        if parse(value) is None:
            raise ValidationError(INVALID_VERSION, code="invalid")
        return value

    def get_prep_value(self, value: Any) -> int | None:
        value = super().get_prep_value(value)
        # 空文字は「制限なし」（to_python と同じ扱い）。
        return None if value in (None, "") else encode(value)

    def formfield(self, **kwargs: Any) -> forms.Field | None:
        defaults: dict[str, Any] = {
            "form_class": forms.CharField,
            "max_length": MAX_LENGTH,
        }
        if self.null:
            # 空欄を空文字ではなく None（制限なし）としてモデルに渡す。
            defaults["empty_value"] = None
        return super().formfield(**{**defaults, **kwargs})
