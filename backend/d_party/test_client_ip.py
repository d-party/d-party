"""管理画面のログイン試行のロック（django-axes）と、そのクライアント IP のテスト。"""

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
        ({"HTTP_CF_CONNECTING_IP": " 2001:db8::1 "}, "2001:db8::1"),
        ({"HTTP_CF_CONNECTING_IP": "2001:0db8:0000::0001"}, "2001:db8::1"),
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


@pytest.fixture
def staff(db):
    return get_user_model().objects.create_superuser(
        username="admin", email="admin@example.com", password=PASSWORD
    )


def _login(client, password: str, ip: str):
    return client.post(
        LOGIN_URL,
        {"username": "admin", "password": password},
        HTTP_CF_CONNECTING_IP=ip,
    )


# テストは DEBUG=1 で走り、settings が axes を切るので、ここでだけ有効にする。
@override_settings(AXES_ENABLED=True, AXES_FAILURE_LIMIT=3)
def test_failures_from_one_ip_do_not_lock_the_user_out_elsewhere(client, staff):
    attacker, operator = "203.0.113.66", "198.51.100.10"
    for _ in range(3):
        _login(client, "wrong", attacker)

    # 間違え続けた IP からは、正しいパスワードでも入れない。
    assert _login(client, PASSWORD, attacker).status_code == 429
    # 別の IP からは、同じユーザー名で入れる。
    response = _login(client, PASSWORD, operator)
    assert response.status_code == 302
    assert response.url == "/admin/"
