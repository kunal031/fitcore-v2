from importlib import import_module

import pytest
from bson import ObjectId

from app.core.exceptions import PaymentException
from app.services.payment_service import payment_service

payment_service_module = import_module("app.services.payment_service")


@pytest.mark.asyncio
async def test_payment_verification_rejects_another_users_payment(monkeypatch):
	class Payment:
		user_id = ObjectId("507f1f77bcf86cd799439011")
		gateway_order_id = "order-a"
		status = "pending"

	async def get_payment(_payment_id):
		return Payment()

	monkeypatch.setattr(payment_service_module.PaymentDocument, "get", get_payment)

	class User:
		id = ObjectId("507f1f77bcf86cd799439012")

	class Payload:
		payment_id = "507f1f77bcf86cd799439013"
		razorpay_order_id = "order-a"

	with pytest.raises(PaymentException, match="another user's payment"):
		await payment_service.verify_payment(User(), Payload())
