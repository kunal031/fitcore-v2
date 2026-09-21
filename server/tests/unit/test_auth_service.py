import pytest

from app.core.exceptions import AuthException
from app.core.security import create_password_reset_token, decode_token


def test_password_reset_token_is_bound_to_phone():
	token = create_password_reset_token("+919999999999")

	assert decode_token(token, expected_type="password_reset")["sub"] == "+919999999999"


def test_password_reset_token_cannot_be_used_as_access_token():
	token = create_password_reset_token("+919999999999")

	with pytest.raises(AuthException):
		decode_token(token, expected_type="access")
