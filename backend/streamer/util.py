from uuid import UUID


def is_valid_uuid(uuid_to_test, version=4) -> bool:
    """Return whether ``uuid_to_test`` is a canonical UUID string.

    Values from the WebSocket are untrusted JSON, so anything that is not a
    ``str`` (numbers, null, objects) is rejected instead of raising.

    >>> is_valid_uuid("c9bf9e57-1685-4c89-bafb-ff5af830be8a")
    True
    >>> is_valid_uuid("c9bf9e58")
    False
    >>> is_valid_uuid(123)
    False
    """
    if not isinstance(uuid_to_test, str):
        return False
    try:
        uuid_obj = UUID(uuid_to_test, version=version)
    except ValueError:
        return False
    return str(uuid_obj) == uuid_to_test
