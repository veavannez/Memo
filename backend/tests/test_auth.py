"""
Tests for authentication and security utilities.
"""
import pytest
from app.core.security import create_access_token, create_refresh_token, decode_token


def test_create_and_decode_access_token():
    token = create_access_token("42")
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["type"] == "access"


def test_create_and_decode_refresh_token():
    token = create_refresh_token("42")
    payload = decode_token(token)
    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["type"] == "refresh"


def test_decode_invalid_token():
    result = decode_token("not.a.valid.token")
    assert result is None


def test_access_token_type_mismatch():
    """Refresh token should not be accepted as access token."""
    refresh = create_refresh_token("42")
    payload = decode_token(refresh)
    assert payload["type"] == "refresh"
    # The /auth/me endpoint should reject this; we just verify type here
    assert payload["type"] != "access"
