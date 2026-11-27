"""管理画面のログイン試行のロック（django-axes）と、そのクライアント IP のテスト。"""

import logging

import pytest
from django.contrib.auth import get_user_model
from django.test import RequestFactory, override_settings

from .client_ip import client_ip

LOGIN_URL = "/admin/login/"
PASSWORD = "correct-horse-battery-staple"  # noqa: S105


@pytest.mark.parametrize(
    ("meta", "expected"),
    [
        ({"HTTP_CF_CONNECTING_IP": "203.0.113.7"}, "203.0.113.7"),
        ({"HTTP_CF_CONNECTING_IP": " 203.0.113.7 "}, "203.0.113.7"),
        # IPv6 は /56 でまとめる。
        ({"HTTP_CF_CONNECTING_IP": "2001:db8:0:12::1"}, "2001:db8::"),
        ({"HTTP_CF_CONNECTING_IP": "2001:db8:0:ff:abcd::9"}, "2001:db8::"),
        ({"HTTP_CF_CONNECTING_IP": "2001:db8:0:100::1"}, "2001:db8:0:100::"),
        # IPv4 射影アドレスは IPv4 として数える。
        ({"HTTP_CF_CONNECTING_IP": "::ffff:203.0.113.7"}, "203.0.113.7"),
        # IP として読めない値はクライアントの言い分なので使わない。
        ({"HTTP_CF_CONNECTING_IP": "203.0.113.7, 10.0.0.1"}, "10.1.2.3"),
        ({"HTTP_CF_CONNECTING_IP": "not-an-ip"}, "10.1.2.3"),
        ({"HTTP_CF_CONNECTING_IP": ""}, "10.1.2.3"),
        ({}, "10.1.2.3"),
    ],
)
def test_client_ip_prefers_a_valid_cf_connecting_ip(meta, expected):
    request = RequestFactory().get("/", REMOTE_ADDR="10.1.2.3", **meta)

    assert client_ip(request) == expected


@pytest.mark.parametrize(("debug", "warned"), [(False, True), (True, False)])
def test_falling_back_to_remote_addr_is_logged_in_production(caplog, debug, warned):
    request = RequestFactory().get("/", REMOTE_ADDR="10.1.2.3")

    with override_settings(DEBUG=debug), caplog.at_level(logging.WARNING):
        assert client_ip(request) == "10.1.2.3"

    assert ("CF-Connecting-IP" in caplog.text) is warned


@pytest.fixture
def staff(db):
    model = get_user_model()
    for name in ("admin", "other"):
        model.objects.create_superuser(
            username=name, email=f"{name}@example.com", password=PASSWORD
        )


def _login(client, password: str, ip: str, username: str = "admin"):
    return client.post(
        LOGIN_URL,
        {"username": username, "password": password},
        HTTP_CF_CONNECTING_IP=ip,
    )


# テストは DEBUG=1 で走り、settings が axes を切るので、ここでだけ有効にする。
@override_settings(AXES_ENABLED=True, AXES_FAILURE_LIMIT=3)
def test_failures_lock_only_the_username_and_ip_pair(client, staff):
    attacker, operator = "203.0.113.66", "198.51.100.10"
    for _ in range(3):
        _login(client, "wrong", attacker)

    # 間違え続けた IP からは、正しいパスワードでも入れない。
    assert _login(client, PASSWORD, attacker).status_code == 429
    # 同じ IP でも別のユーザー名はロックされない（IP だけで数えていない）。
    assert _login(client, PASSWORD, attacker, username="other").status_code == 302
    client.logout()
    # 別の IP からは、同じユーザー名で入れる。
    response = _login(client, PASSWORD, operator)
    assert response.status_code == 302
    assert response.url == "/admin/"


@override_settings(AXES_ENABLED=True, AXES_FAILURE_LIMIT=3)
def test_rotating_ipv6_addresses_in_one_prefix_still_locks(client, staff):
    for host in range(3):
        _login(client, "wrong", f"2001:db8:0:{host:x}::{host + 1:x}")

    assert _login(client, PASSWORD, "2001:db8:0:ff::1234").status_code == 429
    # 別の /56 は別の単位。
    assert _login(client, PASSWORD, "2001:db8:0:100::1").status_code == 302
