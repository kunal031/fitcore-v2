from datetime import datetime, timezone
from typing import List, Optional
from beanie import PydanticObjectId

from app.core.exceptions import ConflictException, NotFoundException
from app.models.coupon import CouponDocument
from app.models.payment import PaymentDocument
from app.models.plan import PlanDocument
from app.schemas.coupon import (
    CouponCreate,
    CouponRead,
    CouponUpdate,
    CouponValidationResponse,
)
from app.utils.date_utils import get_utc_now


def _as_utc(value: datetime) -> datetime:
    """MongoDB returns naive UTC datetimes; make them comparable to get_utc_now()."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class CouponService:
    @staticmethod
    def to_coupon_read(c: CouponDocument) -> CouponRead:
        return CouponRead(
            id=str(c.id),
            code=c.code,
            name=c.name,
            description=c.description,
            discount_type=c.discount_type,
            discount_value=c.discount_value,
            min_plan_price_paise=c.min_plan_price_paise,
            max_discount_paise=c.max_discount_paise,
            max_uses=c.max_uses,
            current_uses=c.current_uses,
            per_user_limit=c.per_user_limit,
            applicable_to=c.applicable_to,
            valid_from=c.valid_from,
            valid_until=c.valid_until,
            is_active=c.is_active,
            created_at=c.created_at,
        )

    async def list_all(self) -> List[CouponRead]:
        coupons = await CouponDocument.find_all().sort("-created_at").to_list()
        return [self.to_coupon_read(c) for c in coupons]

    async def get_by_id(self, coupon_id: str) -> CouponRead:
        coupon = await CouponDocument.get(PydanticObjectId(coupon_id))
        if not coupon:
            raise NotFoundException("Coupon not found", "COUPON_NOT_FOUND")
        return self.to_coupon_read(coupon)

    async def create(self, payload: CouponCreate) -> CouponRead:
        clean_code = payload.code.strip().upper()
        existing = await CouponDocument.find_one(CouponDocument.code == clean_code)
        if existing:
            raise ConflictException(
                message=f"Coupon code '{clean_code}' already exists.",
                error_code="COUPON_CODE_EXISTS",
            )

        now = get_utc_now()
        new_coupon = CouponDocument(
            code=clean_code,
            name=payload.name,
            description=payload.description,
            discount_type=payload.discount_type,
            discount_value=payload.discount_value,
            min_plan_price_paise=payload.min_plan_price_paise,
            max_discount_paise=payload.max_discount_paise,
            max_uses=payload.max_uses,
            per_user_limit=payload.per_user_limit,
            applicable_to=payload.applicable_to,
            valid_from=payload.valid_from or now,
            valid_until=payload.valid_until,
            is_active=True,
        )
        await new_coupon.insert()
        return self.to_coupon_read(new_coupon)

    async def update(self, coupon_id: str, payload: CouponUpdate) -> CouponRead:
        coupon = await CouponDocument.get(PydanticObjectId(coupon_id))
        if not coupon:
            raise NotFoundException("Coupon not found", "COUPON_NOT_FOUND")

        if payload.name is not None:
            coupon.name = payload.name
        if payload.description is not None:
            coupon.description = payload.description
        if payload.max_uses is not None:
            coupon.max_uses = payload.max_uses
        if payload.per_user_limit is not None:
            coupon.per_user_limit = payload.per_user_limit
        if payload.valid_until is not None:
            coupon.valid_until = payload.valid_until
        if payload.is_active is not None:
            coupon.is_active = payload.is_active

        coupon.updated_at = get_utc_now()
        await coupon.save()
        return self.to_coupon_read(coupon)

    async def validate_coupon(
        self,
        code: str,
        plan_id: str,
        user_id: Optional[str] = None,
    ) -> CouponValidationResponse:
        clean_code = code.strip().upper()
        coupon = await CouponDocument.find_one(
            CouponDocument.code == clean_code,
            CouponDocument.is_active == True,
        )
        if not coupon:
            return CouponValidationResponse(
                valid=False, code=clean_code, reason="Coupon code does not exist or is inactive."
            )

        now = get_utc_now()
        if now < _as_utc(coupon.valid_from):
            return CouponValidationResponse(
                valid=False, code=clean_code, reason="Coupon is not yet active."
            )
        if now > _as_utc(coupon.valid_until):
            return CouponValidationResponse(
                valid=False, code=clean_code, reason="Coupon has expired."
            )
        if coupon.current_uses >= coupon.max_uses:
            return CouponValidationResponse(
                valid=False, code=clean_code, reason="Coupon has reached its maximum global usage limit."
            )

        plan = await PlanDocument.get(PydanticObjectId(plan_id))
        if not plan:
            return CouponValidationResponse(
                valid=False, code=clean_code, reason="Selected plan not found."
            )

        if plan.price_paise < coupon.min_plan_price_paise:
            min_inr = coupon.min_plan_price_paise / 100
            return CouponValidationResponse(
                valid=False,
                code=clean_code,
                reason=f"Plan price must be at least ₹{min_inr:,.2f} to use this coupon.",
            )

        if "all" not in coupon.applicable_to and str(plan.id) not in coupon.applicable_to:
            return CouponValidationResponse(
                valid=False,
                code=clean_code,
                reason="This coupon is not applicable to the selected plan.",
            )

        # Check per-user usage if user_id provided
        if user_id:
            user_uses = await PaymentDocument.find(
                PaymentDocument.user_id == PydanticObjectId(user_id),
                PaymentDocument.coupon_details.code == clean_code,
                PaymentDocument.status == "success",
            ).count()
            if user_uses >= coupon.per_user_limit:
                return CouponValidationResponse(
                    valid=False,
                    code=clean_code,
                    reason="You have already used this coupon the maximum allowed times.",
                )

        # Calculate discount
        if coupon.discount_type == "percentage":
            discount = int((plan.price_paise * coupon.discount_value) / 100)
            if coupon.max_discount_paise and discount > coupon.max_discount_paise:
                discount = coupon.max_discount_paise
        else:  # flat_paise
            discount = coupon.discount_value
            if discount > plan.price_paise:
                discount = plan.price_paise

        final_price = max(0, plan.price_paise - discount)

        return CouponValidationResponse(
            valid=True,
            code=clean_code,
            discount_type=coupon.discount_type,
            discount_value=coupon.discount_value,
            discount_paise=discount,
            original_paise=plan.price_paise,
            final_paise=final_price,
            description=coupon.description,
        )


coupon_service = CouponService()
