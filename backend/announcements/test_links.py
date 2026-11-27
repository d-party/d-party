"""本文のリンク（``[テキスト](URL)``）の解釈・表示される文字数・検査のテスト。

拡張機能（``extension/src/domain/announcementText.ts``）と同じ規則であることを、同じ例で
確かめる。
"""

import time

import pytest
from django.core.exceptions import ValidationError

from . import links
from .links import DISPLAY_MAX_LENGTH, Link

URL = "https://d-party.net/docs"


@pytest.mark.parametrize(
    "url",
    [
        "https://d-party.net",
        "https://d-party.net/",
        "https://d-party.net/docs?tab=announce#links",
        "https://d-party.net:8443/a",
        "https://例え.テスト/パス",
        "https://[::1]/",
        "https://en.wikipedia.org/wiki/Foo_%28bar%29",
    ],
)
def test_allowed_url(url):
    assert links.is_allowed_url(url)


@pytest.mark.parametrize(
    "url",
    [
        "http://d-party.net/",  # http
        "HTTPS://d-party.net/",  # 大文字のスキームも認めない（拡張機能と揃える）
        "javascript:alert(1)",
        "javascript://d-party.net/%0Aalert(1)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox",
        "/docs",  # 相対
        "//d-party.net/docs",  # スキーム相対
        "d-party.net/docs",
        "",  # 空
        " https://d-party.net/",  # 先頭の空白
        "https://d-party.net/a b",  # 空白入り
        "https://d-party.net/a\tb",
        "https://d-party.net/\n",
        "https://d-party.net/\u3000",  # 全角空白
        "https://d-party.net/\u200b",  # ゼロ幅（制御・書式文字）
        "https://d-party.net/\x00",
        "https://",  # ホストが無い
        "https:///docs",
        "https://:443/",
        "https://user@d-party.net/",  # ユーザー情報
        "https://d-party.net:pass@evil.example/",
        "https://[::1/",  # 閉じない IPv6
        "https:\\\\d-party.net",
        "https://d-party.net\\@evil.example/",  # バックスラッシュ
    ],
)
def test_disallowed_url(url):
    assert not links.is_allowed_url(url)


def test_parse_plain_text():
    assert links.parse("リンクの無い本文") == ["リンクの無い本文"]
    assert links.parse("") == []


def test_parse_single_link():
    assert links.parse(f"詳しくは[こちら]({URL})を見てください") == [
        "詳しくは",
        Link("こちら", URL),
        "を見てください",
    ]


def test_parse_multiple_links():
    assert links.parse(f"[A]({URL})と[B](https://example.com/b)") == [
        Link("A", URL),
        "と",
        Link("B", "https://example.com/b"),
    ]


@pytest.mark.parametrize(
    "message",
    [
        "[テキスト](http://d-party.net/)",
        "[テキスト](javascript:alert(1))",
        "[テキスト](javascript:alert)",
        "[テキスト](data:text/html,x)",
        "[テキスト](/docs)",
        "[テキスト]()",
        "[テキスト](https://d-party.net/a b)",
        "[](https://d-party.net/)",
        "[ ](https://d-party.net/)",
    ],
)
def test_parse_keeps_disallowed_links_as_text(message):
    assert links.parse(message) == [message]


def test_parse_keeps_other_markdown_as_text():
    message = "**太字** # 見出し <https://d-party.net/> `code`"

    assert links.parse(message) == [message]


def test_parse_mixes_allowed_and_disallowed_links():
    assert links.parse(f"[悪い](javascript:x)と[良い]({URL})") == [
        "[悪い](javascript:x)と",
        Link("良い", URL),
    ]


def test_parse_does_not_interpret_html():
    message = f'[<img src=x onerror="alert(1)">]({URL})'

    assert links.parse(message) == [Link('<img src=x onerror="alert(1)">', URL)]


def test_display_length_counts_link_text_but_not_url():
    message = f"詳しくは[こちら]({URL})"

    assert links.display_text(message) == "詳しくはこちら"
    assert links.display_length(message) == 7


def test_display_length_counts_disallowed_links_as_written():
    message = "[こちら](http://d-party.net/)"

    assert links.display_length(message) == len(message)


@pytest.mark.parametrize(
    "message",
    [
        "リンクの無い本文",
        f"[こちら]({URL})",
        f"[A]({URL})と[B]({URL})",
        "あ" * (DISPLAY_MAX_LENGTH - 3) + f"[いう]({URL})" + "え",
        "角括弧 [注] と丸括弧 (注) はそのまま書ける",
    ],
)
def test_validate_accepts(message):
    links.validate_message(message)


def _errors(message: str) -> list[str]:
    with pytest.raises(ValidationError) as excinfo:
        links.validate_message(message)
    return excinfo.value.messages


@pytest.mark.parametrize(
    "url", ["http://d-party.net/", "javascript:alert", "data:,x", "/docs", ""]
)
def test_validate_rejects_disallowed_url(url):
    assert _errors(f"[こちら]({url})") == [
        (
            f"「[こちら]({url})」の URL はリンクにできません。"
            "https:// で始まり、空白を含まない URL だけを使えます。"
        )
    ]


def test_validate_rejects_url_with_space():
    assert len(_errors("[こちら](https://d-party.net/a b)")) == 1


def test_validate_rejects_empty_link_text():
    assert _errors(f"[]({URL})") == [f"「[]({URL})」はリンクのテキストが空です。"]


@pytest.mark.parametrize(
    "message",
    [
        "[こちら](https://d-party.net/",  # 閉じない
        "[こちら](https://en.wikipedia.org/wiki/Foo_(bar))",  # URL の括弧
        f"[[こちら]]({URL})",  # テキストの角括弧
        f"[こちら]({URL}) と [あちら](",
    ],
)
def test_validate_rejects_broken_link(message):
    assert any("リンクの書き方が崩れています" in error for error in _errors(message))


def test_validate_rejects_long_display_text():
    message = "あ" * DISPLAY_MAX_LENGTH + f"[い]({URL})"

    assert _errors(message) == [
        (
            f"表示される文字数は {DISPLAY_MAX_LENGTH} 文字までです（今は "
            f"{DISPLAY_MAX_LENGTH + 1} 文字。リンクはテキストだけを数え、URL は数えません）。"
        )
    ]


def test_validate_reports_every_link_problem():
    message = "[a](http://x)[](https://x)[b]("

    assert len(_errors(message)) == 3


def test_validate_checks_display_length_after_links_are_fixed():
    # 誤ったリンクは URL ごと数えてしまうので、文字数のエラーは出さない。
    message = "あ" * (DISPLAY_MAX_LENGTH - 5) + "[a](http://d-party.net/)"

    errors = _errors(message)

    assert len(errors) == 1
    assert "の URL はリンクにできません" in errors[0]


@pytest.mark.parametrize(
    "message",
    [
        "[" * 100_000,
        "[a" * 50_000,
        "[a](" * 25_000,
        "[a](b" * 20_000,
        "](" * 50_000,
        "[a]" + "(" * 100_000,
    ],
)
def test_parse_runs_in_linear_time(message):
    # 長い入力でも、バックトラックで時間が爆発しない（ReDoS にならない）。
    started = time.perf_counter()
    links.parse(message)
    links.link_errors(message)
    assert time.perf_counter() - started < 1
