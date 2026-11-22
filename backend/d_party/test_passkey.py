"""管理画面のパスキーログイン（django-otp-webauthn）の配線のテスト。

署名の検証そのものはライブラリの責務なので、ここでは d-party 側の結線だけを見る：
URL が nginx の流す /admin/ 配下にあること、ログイン前に使える口と使えない口、
テンプレートにボタンとスクリプトが出ていること。
"""

import pytest
from django.contrib.auth.models import User
from django.urls import reverse


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(username="root", password="pw")  # noqa: S106


def test_passkey_urls_live_under_admin():
    # admin.site.urls の catch-all に食われず、/admin/ 配下で解決できる。
    assert (
        reverse("otp_webauthn:credential-authentication-begin")
        == "/admin/passkey/authentication/begin/"
    )


@pytest.mark.django_db
def test_login_page_offers_passkey(client):
    html = client.get(reverse("admin:login")).content.decode()

    assert 'id="passkey-verification-button"' in html
    assert "otp_webauthn_auth.js" in html
    # パスワードのフォームは残す。
    assert 'name="password"' in html


@pytest.mark.django_db
def test_authentication_can_begin_without_login(client, settings):
    response = client.post(
        reverse("otp_webauthn:credential-authentication-begin"),
        content_type="application/json",
    )

    assert response.status_code == 200
    body = response.json()
    assert body["rpId"] == settings.OTP_WEBAUTHN_RP_ID
    assert body["challenge"]


@pytest.mark.django_db
def test_registration_requires_login(client):
    response = client.post(
        reverse("otp_webauthn:credential-registration-begin"),
        content_type="application/json",
    )

    assert response.status_code in {401, 403}


@pytest.mark.django_db
def test_logged_in_admin_can_begin_registration(client, superuser):
    client.force_login(superuser)

    response = client.post(
        reverse("otp_webauthn:credential-registration-begin"),
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["user"]["name"] == "root"


@pytest.mark.django_db
def test_credential_list_offers_registration(client, superuser):
    client.force_login(superuser)

    html = client.get(
        reverse("admin:django_otp_webauthn_webauthncredential_changelist")
    ).content.decode()

    assert 'id="passkey-register-button"' in html
    assert "otp_webauthn_register.js" in html
