from app.core.security import (
    decrypt_secret,
    encrypt_secret,
    hash_password,
    key_last4,
    mask_key,
    verify_password,
)


def test_password_hash_roundtrip():
    hashed = hash_password("correct horse battery staple")
    assert hashed != "correct horse battery staple"
    assert verify_password("correct horse battery staple", hashed)
    assert not verify_password("wrong", hashed)
    assert not verify_password("anything", "not-a-hash")


def test_secret_encryption_roundtrip_and_wrong_key():
    token = encrypt_secret("sk-or-v1-abcdef1234", secret="one")
    assert token != "sk-or-v1-abcdef1234"
    assert decrypt_secret(token, secret="one") == "sk-or-v1-abcdef1234"
    assert decrypt_secret(token, secret="two") is None
    assert decrypt_secret("garbage", secret="one") is None


def test_mask_key():
    assert key_last4("sk-or-v1-abcdef1234 ") == "1234"
    assert mask_key("1234") == "sk-or-••••••••1234"
    assert mask_key(None) is None
