"""Password hashing and encryption of user-supplied provider keys."""

import base64
import hashlib
import secrets

import bcrypt
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

# bcrypt ignores everything after 72 bytes; refuse longer passwords at the schema level.
MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))
    except (ValueError, TypeError):
        return False


def _fernet(secret: str | None = None) -> Fernet:
    raw = (secret or settings.SECRET_KEY).encode("utf-8")
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)


def encrypt_secret(value: str, secret: str | None = None) -> str:
    return _fernet(secret).encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str, secret: str | None = None) -> str | None:
    """Return the plaintext, or None when the token is invalid (e.g. SECRET_KEY changed)."""
    try:
        return _fernet(secret).decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError):
        return None


def key_last4(value: str) -> str:
    return value.strip()[-4:]


def mask_key(last4: str | None, prefix: str = "sk-or-") -> str | None:
    if not last4:
        return None
    return f"{prefix}••••••••{last4}"


def random_token(nbytes: int = 16) -> str:
    return secrets.token_urlsafe(nbytes)
