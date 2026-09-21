import hashlib
import hmac
from typing import List, Optional
from beanie import PydanticObjectId
from loguru import logger
import razorpay

from app.core.config import settings
from app.core.exceptions import (
    ConflictException,
    NotFoundException,
    PaymentException,
    ValidationException,
)
from app.models.coupon import CouponDocument
from app.models.payment import (
    PaymentCouponDetails,
    PaymentDocument,
    PaymentReferralDetails,
)
from app.models.plan import PlanDocument
from app.models.referral import ReferralDocument
from app.models.user import UserDocument
from app.schemas.payment import (
    DiscountBreakdown,
    InitiatePaymentRequest,
    InitiatePaymentResponse,
    ManualPaymentRequest,
    PaymentPrefill,
    PaymentRead,
    VerifyPaymentRequest,
)
from app.services.coupon_service import coupon_service
from app.services.referral_service import referral_service
from app.services.subscription_service import subscription_service
from app.utils.date_utils import get_utc_now
from app.utils.formatters import paise_to_inr
from app.utils.generators import generate_receipt_number


class PaymentService:
    def __init__(self) -> None:
        try:
            self.razorpay_client = razorpay.Client(
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
            )
        except Exception as e:
            logger.warning(f"Razorpay client init warning: {e}")
            self.razorpay_client = None

    @staticmethod
    def to_payment_read(p: PaymentDocument) -> PaymentRead:
        return PaymentRead(
            id=str(p.id),
            user_id=str(p.user_id),
            plan_id=str(p.plan_id),
            receipt_number=p.receipt_number,
            amount_paise=p.amount_paise,
            discount_paise=p.discount_paise,
            final_amount_paise=p.final_amount_paise,
            amount_paid_inr=paise_to_inr(p.final_amount_paise),
            payment_method=p.payment_method,
            status=p.status,
            gateway_order_id=p.gateway_order_id,
            gateway_payment_id=p.gateway_payment_id,
            note=p.note,
            created_at=p.created_at,
        )

    async def initiate_checkout(
        self,
        user: UserDocument,
        payload: InitiatePaymentRequest,
    ) -> InitiatePaymentResponse:
        plan = await PlanDocument.get(PydanticObjectId(payload.plan_id))
        if not plan or not plan.is_active:
            raise NotFoundException("Selected plan not found or is inactive", "PLAN_NOT_FOUND")

        original_paise = plan.price_paise
        coupon_discount = 0
        coupon_code_clean = None
        if payload.coupon_code:
            coupon_res = await coupon_service.validate_coupon(
                code=payload.coupon_code,
                plan_id=str(plan.id),
                user_id=str(user.id),
            )
            if not coupon_res.valid:
                raise ValidationException(
                    message=coupon_res.reason or "Invalid coupon code",
                    error_code="INVALID_COUPON",
                    field="coupon_code",
                )
            coupon_discount = coupon_res.discount_paise
            coupon_code_clean = coupon_res.code

        # Referral discount on first purchase
        referral_discount = 0
        ref_code_clean = None
        if payload.referral_code:
            ref_code_clean = payload.referral_code.strip().upper()
            ref_doc = await ReferralDocument.find_one(
                ReferralDocument.referral_code == ref_code_clean,
                ReferralDocument.is_active == True,
            )
            if ref_doc:
                # Only apply if user has no past successful payments
                past_payments = await PaymentDocument.find(
                    PaymentDocument.user_id == user.id,
                    PaymentDocument.status == "success",
                ).count()
                if past_payments == 0:
                    referral_discount = min(ref_doc.referee_discount_value, original_paise - coupon_discount)

        total_discount = coupon_discount + referral_discount
        final_paise = max(0, original_paise - total_discount)
        receipt_no = generate_receipt_number()

        # Create Razorpay order
        rzp_order_id = f"order_mock_{receipt_no}"
        if self.razorpay_client and not settings.RAZORPAY_KEY_ID.startswith("rzp_test_xxxx"):
            try:
                order_data = {
                    "amount": final_paise,
                    "currency": "INR",
                    "receipt": receipt_no,
                    "payment_capture": 1,
                }
                rzp_order = self.razorpay_client.order.create(data=order_data)
                rzp_order_id = rzp_order.get("id", rzp_order_id)
            except Exception as e:
                logger.error(f"Razorpay order creation failed: {e}")
                raise PaymentException("Could not initiate gateway order. Please retry.")

        # Save pending payment document
        payment = PaymentDocument(
            user_id=user.id,
            plan_id=plan.id,
            receipt_number=receipt_no,
            amount_paise=original_paise,
            discount_paise=total_discount,
            final_amount_paise=final_paise,
            payment_method="razorpay",
            status="pending",
            gateway_order_id=rzp_order_id,
            coupon_details=PaymentCouponDetails(code=coupon_code_clean, discount_paise=coupon_discount)
            if coupon_code_clean
            else None,
            referral_details=PaymentReferralDetails(code=ref_code_clean, discount_paise=referral_discount)
            if ref_code_clean
            else None,
        )
        await payment.insert()

        return InitiatePaymentResponse(
            payment_id=str(payment.id),
            razorpay_order_id=rzp_order_id,
            razorpay_key_id=settings.RAZORPAY_KEY_ID,
            amount_paise=final_paise,
            currency="INR",
            discount_breakdown=DiscountBreakdown(
                original_paise=original_paise,
                coupon_discount_paise=coupon_discount,
                referral_discount_paise=referral_discount,
                final_paise=final_paise,
            ),
            prefill=PaymentPrefill(
                name=user.full_name,
                contact=user.phone,
            ),
        )

    async def verify_payment(
        self,
        user: UserDocument,
        payload: VerifyPaymentRequest,
    ) -> PaymentRead:
        payment = await PaymentDocument.get(PydanticObjectId(payload.payment_id))
        if not payment:
            raise NotFoundException("Payment record not found", "PAYMENT_NOT_FOUND")

        if payment.user_id != user.id:
            raise PaymentException("You cannot verify another user's payment.", "PAYMENT_FORBIDDEN")

        if payment.gateway_order_id != payload.razorpay_order_id:
            raise PaymentException("Payment order does not match the payment record.", "ORDER_MISMATCH")

        if payment.status == "success":
            return self.to_payment_read(payment)

        # Verify signature if live credentials
        if self.razorpay_client and not settings.RAZORPAY_KEY_SECRET.startswith("your_"):
            body = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
            expected_signature = hmac.new(
                settings.RAZORPAY_KEY_SECRET.encode(),
                body.encode(),
                hashlib.sha256,
            ).hexdigest()

            if not hmac.compare_digest(expected_signature, payload.razorpay_signature):
                payment.status = "failed"
                payment.updated_at = get_utc_now()
                await payment.save()
                raise PaymentException("Payment signature verification failed.", "SIGNATURE_MISMATCH")

        # Mark payment successful
        payment.status = "success"
        payment.gateway_payment_id = payload.razorpay_payment_id
        payment.gateway_signature = payload.razorpay_signature
        payment.updated_at = get_utc_now()
        await payment.save()

        # Create Subscription
        await subscription_service.create_subscription(
            user_id=user.id,
            plan_id=payment.plan_id,
            payment_id=payment.id,
        )

        # Increment coupon uses
        if payment.coupon_details:
            coupon = await CouponDocument.find_one(CouponDocument.code == payment.coupon_details.code)
            if coupon:
                coupon.current_uses += 1
                coupon.updated_at = get_utc_now()
                await coupon.save()

        # Issue referral reward if applicable
        if payment.referral_details:
            await referral_service.issue_reward_on_purchase(
                referee_user_id=user.id,
                referral_code=payment.referral_details.code,
            )

        return self.to_payment_read(payment)

    async def record_manual_payment(
        self,
        staff_user: UserDocument,
        payload: ManualPaymentRequest,
    ) -> PaymentRead:
        member = await UserDocument.get(PydanticObjectId(payload.member_id))
        if not member:
            raise NotFoundException("Member not found", "MEMBER_NOT_FOUND")

        plan = await PlanDocument.get(PydanticObjectId(payload.plan_id))
        if not plan:
            raise NotFoundException("Plan not found", "PLAN_NOT_FOUND")

        receipt_no = generate_receipt_number()
        payment = PaymentDocument(
            user_id=member.id,
            plan_id=plan.id,
            receipt_number=receipt_no,
            amount_paise=plan.price_paise,
            discount_paise=max(0, plan.price_paise - payload.amount_paise),
            final_amount_paise=payload.amount_paise,
            payment_method=payload.payment_method,
            status="success",
            gateway_payment_id=payload.upi_ref,
            note=payload.note,
            recorded_by=staff_user.id,
        )
        await payment.insert()

        # Activate subscription immediately
        await subscription_service.create_subscription(
            user_id=member.id,
            plan_id=plan.id,
            payment_id=payment.id,
        )

        return self.to_payment_read(payment)

    async def get_my_payments(self, user_id: str) -> List[PaymentRead]:
        payments = await PaymentDocument.find(
            PaymentDocument.user_id == PydanticObjectId(user_id)
        ).sort("-created_at").to_list()
        return [self.to_payment_read(p) for p in payments]

    async def list_all_payments(self, limit: int = 50) -> List[PaymentRead]:
        payments = await PaymentDocument.find_all().sort("-created_at").limit(limit).to_list()
        return [self.to_payment_read(p) for p in payments]


payment_service = PaymentService()
