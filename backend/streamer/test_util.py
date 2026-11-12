import pytest

from .util import is_valid_uuid


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("c9bf9e57-1685-4c89-bafb-ff5af830be8a", True),
        ("c9bf9e58", False),
        ("C9BF9E57-1685-4C89-BAFB-FF5AF830BE8A", False),
        (123, False),
        (None, False),
        (["c9bf9e57-1685-4c89-bafb-ff5af830be8a"], False),
        ({"a": 1}, False),
    ],
)
def test_is_valid_uuid(value, expected):
    assert is_valid_uuid(value) is expected
