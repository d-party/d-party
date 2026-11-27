"""``settings.py`` と ``urls.py`` の、``DEBUG`` で切り替わる値のテスト。

テストは ``DEBUG=1`` の env で走るので、本番側の分岐は settings を別の名前空間で
実行して確かめる（``django.conf.settings`` には触れない）。
"""

import importlib
import runpy

import pytest
from django.urls import Resolver404, URLResolver, clear_url_caches
from django.urls.resolvers import RegexPattern

import d_party.settings
import d_party.urls


@pytest.fixture
def load_settings(monkeypatch):
    def load(*, debug: bool) -> dict:
        monkeypatch.setenv("DEBUG", "1" if debug else "0")
        monkeypatch.setenv("MY_DOMAIN", "d-party.example")
        return runpy.run_path(d_party.settings.__file__)

    return load


def test_production_hardening(load_settings):
    loaded = load_settings(debug=False)

    assert loaded["DEBUG"] is False
    assert loaded["ALLOWED_HOSTS"] == [
        "d-party.example",
        "www.d-party.example",
        "django",
    ]
    # サブドメインをワイルドカードで信頼しない。
    assert loaded["CSRF_TRUSTED_ORIGINS"] == [
        "https://d-party.example",
        "https://www.d-party.example",
    ]
    assert loaded["SESSION_COOKIE_SECURE"] is True
    assert loaded["CSRF_COOKIE_SECURE"] is True
    assert loaded["SECURE_PROXY_SSL_HEADER"] == ("HTTP_X_FORWARDED_PROTO", "https")
    # 開発用のコマンドは本番に載せない。
    assert "django_extensions" not in loaded["INSTALLED_APPS"]
    # axes（ログイン試行のロック）は既定で有効。ユーザー名だけでロックすると、誰でも
    # スタッフを締め出せるので、IP との組で数える。
    assert "AXES_ENABLED" not in loaded
    assert loaded["AXES_LOCKOUT_PARAMETERS"] == [["username", "ip_address"]]
    assert loaded["AXES_CLIENT_IP_CALLABLE"] == "d_party.client_ip.client_ip"
    assert loaded["OTP_WEBAUTHN_RP_ID"] == "d-party.example"
    assert loaded["OTP_WEBAUTHN_ALLOWED_ORIGINS"] == [
        "https://d-party.example",
        "https://www.d-party.example",
    ]


def test_debug_relaxations(load_settings):
    loaded = load_settings(debug=True)

    assert loaded["DEBUG"] is True
    # DEBUG=1 のまま本番に出ても Host ヘッダを偽装させない。
    assert "*" not in loaded["ALLOWED_HOSTS"]
    assert {"localhost", "127.0.0.1", "testserver"} <= set(loaded["ALLOWED_HOSTS"])
    assert "SESSION_COOKIE_SECURE" not in loaded
    assert "SECURE_PROXY_SSL_HEADER" not in loaded
    assert loaded["AXES_ENABLED"] is False
    assert "django_extensions" in loaded["INSTALLED_APPS"]
    assert "http://localhost:8000" in loaded["OTP_WEBAUTHN_ALLOWED_ORIGINS"]


def test_csp_is_report_only_and_keeps_inline_scripts_out(load_settings):
    loaded = load_settings(debug=False)

    assert (
        "django.middleware.csp.ContentSecurityPolicyMiddleware" in loaded["MIDDLEWARE"]
    )
    # まだ強制しない（SECURE_CSP は既定の空のまま）。
    assert "SECURE_CSP" not in loaded
    policy = loaded["SECURE_CSP_REPORT_ONLY"]
    assert policy["default-src"] == ["'self'"]
    assert "'unsafe-inline'" not in policy["script-src"]
    assert policy["object-src"] == ["'none'"]
    assert policy["frame-ancestors"] == ["'none'"]


@pytest.mark.django_db
def test_admin_pages_carry_the_report_only_header(client):
    response = client.get("/admin/login/")

    assert "Content-Security-Policy" not in response
    header = response["Content-Security-Policy-Report-Only"]
    assert "default-src 'self'" in header
    assert "script-src 'self' 'unsafe-eval'" in header


@pytest.fixture
def load_urlpatterns(settings):
    def load(*, debug: bool):
        settings.DEBUG = debug
        return importlib.reload(d_party.urls).urlpatterns

    yield load
    # pytest-django が DEBUG を戻した後の状態で読み直す。
    settings.DEBUG = False
    importlib.reload(d_party.urls)
    clear_url_caches()


def _serves_static(urlpatterns) -> bool:
    resolver = URLResolver(RegexPattern(r"^/"), urlpatterns)
    try:
        resolver.resolve("/static/admin/css/base.css")
    except Resolver404:
        return False
    return True


def test_static_files_are_served_by_django_only_in_debug(load_urlpatterns):
    assert _serves_static(load_urlpatterns(debug=True))
    assert not _serves_static(load_urlpatterns(debug=False))


def test_passkey_urls_come_before_the_admin_catch_all(load_urlpatterns):
    routes = [str(pattern.pattern) for pattern in load_urlpatterns(debug=False)]

    assert routes == ["admin/passkey/", "admin/", "api/"]
