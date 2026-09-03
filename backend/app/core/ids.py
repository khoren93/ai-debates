"""Short public identifiers (share slugs)."""

import secrets

_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"  # no ambiguous characters


def new_slug(length: int = 10) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(length))
