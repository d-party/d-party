"""アナウンスの本文に書けるリンク（Markdown のインラインリンク ``[テキスト](URL)``）。

拡張機能（``extension/src/domain/announcementText.ts``）と同じ規則で読む。片側だけ変えないこと。

- 書けるのはインラインリンクだけ。ほかの Markdown（太字・見出し・自動リンクなど）は扱わず、
  そのまま文字として出る。1 つの本文に複数のリンクを書いてよい。
- リンクにできる URL は ``https://`` で始まり、ホストがあり、空白・制御文字・バックスラッシュ・
  ユーザー情報（``https://user@host``）を含まないものだけ。
- 本文の長さは「表示される文字数」（リンクはテキストだけを数え、URL は数えない）と、URL を
  含む生の文字列の長さの 2 つで制限する。

管理画面では、許可しない URL のリンク・空のテキスト・崩れた書き方をフォームのエラーにする。
拡張機能は DB に直接入った値にも備えて同じ検査をし、満たさないものは元の文字列のまま出す。
"""

import re
import unicodedata
from dataclasses import dataclass
from urllib.parse import urlsplit

from django.core.exceptions import ValidationError

# 表示される文字数の上限。拡張機能のポップアップ（幅 360px）とサイドバー（幅 320px）に
# 2〜3 行で収まる長さ。
DISPLAY_MAX_LENGTH = 60
# URL を含む生の文字列の上限（DB の列の長さ）。
RAW_MAX_LENGTH = 500

# ``[テキスト](URL)``。各グループは否定の文字クラス 1 つだけで、その直後の区切り文字
# （``]`` · ``)``）をクラスに含まないので、バックトラックが積み重ならない（ReDoS にならない）。
# テキストに ``[ ]``、URL に ``( )`` は書けない（URL の括弧は ``%28`` ``%29`` にする）。
LINK_RE = re.compile(r"\[([^\[\]]*)\]\(([^()]*)\)")

# リンクの書き方の名残り。正しいリンクを取り除いた後に残っていれば、崩れた書き方とみなす。
_BROKEN_LINK_MARK = "]("

ALLOWED_SCHEME_PREFIX = "https://"


@dataclass(frozen=True)
class Link:
    text: str
    url: str


type Segment = str | Link


def is_allowed_url(url: str) -> bool:
    """リンクにしてよい URL か（``https://`` で始まり、ホストがあり、空白・制御文字・
    バックスラッシュ・ユーザー情報を含まない）。"""
    if not url.startswith(ALLOWED_SCHEME_PREFIX):
        return False
    # バックスラッシュは、ブラウザ（WHATWG URL）が / と読み、Python の urlsplit と食い違うので弾く。
    if "\\" in url or any(
        char.isspace() or unicodedata.category(char)[0] == "C" for char in url
    ):
        return False
    try:
        parts = urlsplit(url)
        hostname = parts.hostname
    except ValueError:  # 角括弧の閉じない IPv6 など
        return False
    return (
        parts.scheme == "https"
        and bool(hostname)
        and parts.username is None
        and parts.password is None
    )


def _as_link(text: str, url: str) -> Link | None:
    if not text.strip() or not is_allowed_url(url):
        return None
    return Link(text, url)


def parse(message: str) -> list[Segment]:
    """本文を文字列とリンクの並びに分ける。リンクにできないものは元の文字列のまま残す。"""
    segments: list[Segment] = []
    rest = 0
    for match in LINK_RE.finditer(message):
        link = _as_link(match[1], match[2])
        if link is None:
            continue
        if match.start() > rest:
            segments.append(message[rest : match.start()])
        segments.append(link)
        rest = match.end()
    if rest < len(message):
        segments.append(message[rest:])
    return segments


def display_text(message: str) -> str:
    """拡張機能に表示される文字列（リンクはテキストだけにする）。"""
    return "".join(
        segment.text if isinstance(segment, Link) else segment
        for segment in parse(message)
    )


def display_length(message: str) -> int:
    """表示される文字数。リンクはテキストを数え、URL は数えない。"""
    return len(display_text(message))


def link_errors(message: str) -> list[str]:
    """リンクの書き方の誤り（許可しない URL · 空のテキスト · 崩れた書き方）。"""
    errors: list[str] = []
    for match in LINK_RE.finditer(message):
        text, url = match[1], match[2]
        if not text.strip():
            errors.append(f"「{match[0]}」はリンクのテキストが空です。")
        elif not is_allowed_url(url):
            errors.append(
                f"「{match[0]}」の URL はリンクにできません。"
                "https:// で始まり、空白を含まない URL だけを使えます。"
            )
    if _BROKEN_LINK_MARK in LINK_RE.sub("", message):
        errors.append(
            "リンクの書き方が崩れています。[テキスト](https://…) の形で書いてください"
            "（テキストに [ ]、URL に ( ) は使えません。URL の括弧は %28 %29 にします）。"
        )
    return errors


def validate_message(message: str) -> None:
    """本文の検査（モデルのフィールドの validator）。生の文字列の長さは ``max_length`` が見る。"""
    errors = link_errors(message)
    # 書き方に誤りがあると、そのリンクは URL ごと数えてしまうので、文字数は直した後に見る。
    length = display_length(message)
    if not errors and length > DISPLAY_MAX_LENGTH:
        errors.append(
            f"表示される文字数は {DISPLAY_MAX_LENGTH} 文字までです（今は {length} 文字。"
            "リンクはテキストだけを数え、URL は数えません）。"
        )
    if errors:
        raise ValidationError(errors, code="invalid_announcement_message")
