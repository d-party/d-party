"""Transparent application-level encryption for model fields.

``EncryptedCharField`` stores values as Fernet tokens (AES-128-CBC + HMAC, from
the ``cryptography`` package). The key is derived from ``settings.SECRET_KEY``,
so rotating ``SECRET_KEY`` makes existing values undecryptable. Plaintext is
encrypted on write and decrypted on read, so application code keeps reading and
writing ordinary ``str`` values.
"""

from __future__ import annotations

import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet
from django.conf import settings
from django.db import models


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


class EncryptedCharField(models.CharField):
    """A ``CharField`` whose value is encrypted at rest.

    The plaintext ``max_length`` still drives form validation, but the value is
    stored as an opaque Fernet token, so the underlying column is ``text``.
    """

    def get_internal_type(self) -> str:
        return "TextField"

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value is None:
            return None
        return _fernet().encrypt(str(value).encode("utf-8")).decode("utf-8")

    def from_db_value(self, value, expression, connection):
        if value is None:
            return None
        return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
