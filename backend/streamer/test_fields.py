"""``EncryptedCharField``（``AnimeUser.user_name``）のテスト。"""

import pytest
from django.db import connection

from .factories import AnimeRoomFactory
from .fields import EncryptedCharField
from .models import AnimeUser


def test_round_trip():
    field = EncryptedCharField(max_length=20)
    ciphertext = field.get_prep_value("たんじろう")

    assert ciphertext != "たんじろう"
    assert field.from_db_value(ciphertext, None, None) == "たんじろう"


def test_same_plaintext_encrypts_to_different_tokens():
    """暗号文から同名のユーザーを突き合わせられない（Fernet は IV を毎回変える）。"""
    field = EncryptedCharField(max_length=20)

    assert field.get_prep_value("user") != field.get_prep_value("user")


def test_none_passes_through():
    field = EncryptedCharField(max_length=20, null=True)

    assert field.get_prep_value(None) is None
    assert field.from_db_value(None, None, None) is None


def test_column_is_text():
    """暗号文は max_length より長いので、列は varchar(20) ではなく text にする。"""
    assert EncryptedCharField(max_length=20).get_internal_type() == "TextField"


@pytest.mark.django_db
def test_user_name_is_not_stored_in_plaintext():
    user = AnimeUser.objects.create(user_name="ねずこ", room_id=AnimeRoomFactory())

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT user_name FROM streamer_animeuser WHERE user_id = %s",
            [user.user_id],
        )
        (stored,) = cursor.fetchone()

    assert "ねずこ" not in stored
    assert AnimeUser.objects.get(pk=user.pk).user_name == "ねずこ"
    assert str(user) == "ねずこ"
