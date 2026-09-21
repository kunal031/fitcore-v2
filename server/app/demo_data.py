import asyncio
from datetime import datetime, timedelta, timezone

from loguru import logger

from app.core.database import close_database_connection, connect_to_database
from app.core.security import hash_password
from app.models.coupon import CouponDocument
from app.models.payment import PaymentDocument
from app.models.plan import PlanDocument
from app.models.referral import ReferralDocument
from app.models.subscription import AttendanceEntry, PlanSnapshot, SubscriptionDocument
from app.models.user import (
    AddressSubdocument,
    GymMetaSubdocument,
    UserDocument,
    UserProfileSubdocument,
)
from app.utils.date_utils import get_utc_now

DEMO_PLANS = [
    {
        "plan_name": "Demo Starter Monthly",
        "description": "A focused monthly plan for members building a steady routine.",
        "category": "basic",
        "price_paise": 100000,
        "calendar_days": 30,
        "allocated_days": 24,
        "features": ["Gym floor access", "Cardio zone", "Locker room"],
    },
    {
        "plan_name": "Demo Strength Monthly",
        "description": "A balanced monthly plan for strength and conditioning work.",
        "category": "standard",
        "price_paise": 145000,
        "calendar_days": 30,
        "allocated_days": 26,
        "features": ["Full equipment access", "Trainer guidance", "Locker room"],
    },
    {
        "plan_name": "Demo Performance Quarterly",
        "description": "A longer commitment with extra time to build performance.",
        "category": "standard",
        "price_paise": 390000,
        "calendar_days": 90,
        "allocated_days": 78,
        "features": ["Full equipment access", "Progress review", "Steam room"],
    },
    {
        "plan_name": "Demo Elite Half Year",
        "description": "A six-month plan for consistent training and measurable progress.",
        "category": "premium",
        "price_paise": 680000,
        "calendar_days": 180,
        "allocated_days": 156,
        "features": ["All equipment access", "Monthly trainer review", "Nutrition check-in"],
    },
    {
        "plan_name": "Demo Annual Unlimited",
        "description": "Year-round access for members who want a full training lifestyle.",
        "category": "premium",
        "price_paise": 1100000,
        "calendar_days": 365,
        "allocated_days": 312,
        "features": ["Unlimited gym access", "Personal training review", "All amenities"],
    },
]

EXPIRED_PLANS = [
    {
        "plan_name": "Demo Legacy Flex Plan",
        "description": "Archived plan kept for previous purchase history.",
        "category": "basic",
        "price_paise": 85000,
        "calendar_days": 30,
        "allocated_days": 20,
        "features": ["Gym floor access"],
    },
    {
        "plan_name": "Demo Legacy Gold Plan",
        "description": "Archived plan kept for historical records.",
        "category": "standard",
        "price_paise": 125000,
        "calendar_days": 30,
        "allocated_days": 24,
        "features": ["Full equipment access", "Locker room"],
    },
]

DEMO_COUPONS = [
    {
        "code": "DEMO10",
        "name": "Demo Welcome 10",
        "description": "Ten percent off for demo checkout testing.",
        "discount_type": "percentage",
        "discount_value": 10,
        "min_plan_price_paise": 0,
        "max_discount_paise": 20000,
        "max_uses": 100,
        "per_user_limit": 1,
        "days": 90,
    },
    {
        "code": "DEMO200",
        "name": "Demo Flat 200",
        "description": "Two hundred rupees off for demo checkout testing.",
        "discount_type": "flat_paise",
        "discount_value": 20000,
        "min_plan_price_paise": 100000,
        "max_uses": 100,
        "per_user_limit": 1,
        "days": 90,
    },
    {
        "code": "DEMO15",
        "name": "Demo Fitness 15",
        "description": "Fifteen percent off selected demo plans.",
        "discount_type": "percentage",
        "discount_value": 15,
        "min_plan_price_paise": 145000,
        "max_discount_paise": 30000,
        "max_uses": 75,
        "per_user_limit": 1,
        "days": 120,
    },
    {
        "code": "DEMO500",
        "name": "Demo Premium 500",
        "description": "Five hundred rupees off premium demo plans.",
        "discount_type": "flat_paise",
        "discount_value": 50000,
        "min_plan_price_paise": 390000,
        "max_uses": 50,
        "per_user_limit": 1,
        "days": 120,
    },
    {
        "code": "DEMO20",
        "name": "Demo Anniversary 20",
        "description": "Twenty percent off for anniversary flow testing.",
        "discount_type": "percentage",
        "discount_value": 20,
        "min_plan_price_paise": 680000,
        "max_discount_paise": 100000,
        "max_uses": 25,
        "per_user_limit": 1,
        "days": 180,
    },
]

DEMO_USERS = [
    ("Demo Member 01", "+919100000001", "demo.member01@example.com", "DEMOUSER01"),
    ("Demo Member 02", "+919100000002", "demo.member02@example.com", "DEMOUSER02"),
    ("Demo Member 03", "+919100000003", "demo.member03@example.com", "DEMOUSER03"),
    ("Demo Member 04", "+919100000004", "demo.member04@example.com", "DEMOUSER04"),
    ("Demo Member 05", "+919100000005", "demo.member05@example.com", "DEMOUSER05"),
    ("Demo Member 06", "+919100000006", "demo.member06@example.com", "DEMOUSER06"),
    ("Demo Member 07", "+919100000007", "demo.member07@example.com", "DEMOUSER07"),
    ("Demo Member 08", "+919100000008", "demo.member08@example.com", "DEMOUSER08"),
    ("Demo Member 09", "+919100000009", "demo.member09@example.com", "DEMOUSER09"),
    ("Demo Member 10", "+919100000010", "demo.member10@example.com", "DEMOUSER10"),
]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def ensure_plans() -> tuple[list[PlanDocument], list[PlanDocument]]:
    active_plans = []
    for plan_data in DEMO_PLANS:
        plan = await PlanDocument.find_one(PlanDocument.plan_name == plan_data["plan_name"])
        if not plan:
            plan = PlanDocument(**plan_data, is_active=True)
            await plan.insert()
        elif not plan.is_active:
            plan.is_active = True
            plan.updated_at = get_utc_now()
            await plan.save()
        active_plans.append(plan)

    expired_plans = []
    for plan_data in EXPIRED_PLANS:
        plan = await PlanDocument.find_one(PlanDocument.plan_name == plan_data["plan_name"])
        if not plan:
            plan = PlanDocument(**plan_data, is_active=False)
            await plan.insert()
        elif plan.is_active:
            plan.is_active = False
            plan.updated_at = get_utc_now()
            await plan.save()
        expired_plans.append(plan)

    return active_plans, expired_plans


async def ensure_coupons() -> list[CouponDocument]:
    now = get_utc_now()
    coupons = []
    for coupon_data in DEMO_COUPONS:
        plan_data = {key: value for key, value in coupon_data.items() if key != "days"}
        plan_data["valid_from"] = now
        plan_data["valid_until"] = now + timedelta(days=coupon_data["days"])
        coupon = await CouponDocument.find_one(CouponDocument.code == coupon_data["code"])
        if not coupon:
            coupon = CouponDocument(**plan_data, is_active=True)
            await coupon.insert()
        coupons.append(coupon)
    return coupons


async def ensure_member(
    full_name: str,
    phone: str,
    email: str,
    referral_code: str,
    trainer_id,
) -> UserDocument:
    member = await UserDocument.find_one(UserDocument.phone == phone)
    if not member:
        member = UserDocument(
            phone=phone,
            hashed_password=hash_password("Member@123"),
            role="member",
            full_name=full_name,
            email=email,
            profile=UserProfileSubdocument(
                gender="other",
                address=AddressSubdocument(city="Pune", state="Maharashtra", pincode="411045"),
            ),
            gym_meta=GymMetaSubdocument(
                membership_status="active",
                assigned_trainer_id=trainer_id,
            ),
            my_referral_code=referral_code,
            loyalty_points=100,
            is_active=True,
        )
        await member.insert()
    return member


async def ensure_referral(member: UserDocument) -> None:
    existing = await ReferralDocument.find_one({"referrer_user_id": member.id})
    if not existing:
        await ReferralDocument(
            referrer_user_id=member.id,
            referral_code=member.my_referral_code,
        ).insert()


async def ensure_subscription(
    member: UserDocument,
    plan: PlanDocument,
    trainer_id,
    index: int,
) -> None:
    existing = await SubscriptionDocument.find_one(
        {"user_id": member.id, "plan_id": plan.id, "status": "active"}
    )
    if existing:
        return

    started_on = (utc_now() - timedelta(days=8 + index)).date()
    days_used = min(3 + index, plan.allocated_days - 1)
    expiry = started_on + timedelta(days=plan.calendar_days)
    final_amount = plan.price_paise
    receipt = f"DEMO-{index + 1:02d}-{plan.id}"

    payment = await PaymentDocument.find_one(PaymentDocument.receipt_number == receipt)
    if not payment:
        payment = PaymentDocument(
            user_id=member.id,
            plan_id=plan.id,
            receipt_number=receipt,
            amount_paise=plan.price_paise,
            final_amount_paise=final_amount,
            payment_method="cash",
            status="success",
            note="Demo payment record",
            recorded_by=trainer_id,
        )
        await payment.insert()

    attendance_log = [
        AttendanceEntry(
            date=(started_on + timedelta(days=day_offset)).isoformat(),
            check_in_time=datetime.combine(
                started_on + timedelta(days=day_offset),
                datetime.min.time(),
                tzinfo=timezone.utc,
            ).replace(hour=7 + (index % 3), minute=15),
            marked_by=trainer_id,
        )
        for day_offset in range(days_used)
    ]
    subscription = SubscriptionDocument(
        user_id=member.id,
        plan_id=plan.id,
        payment_id=payment.id,
        plan_snapshot=PlanSnapshot(
            plan_name=plan.plan_name,
            price_paise=plan.price_paise,
            allocated_days=plan.allocated_days,
            calendar_days=plan.calendar_days,
            features=plan.features,
        ),
        status="active",
        allocated_days=plan.allocated_days,
        days_used=days_used,
        days_remaining=plan.allocated_days - days_used,
        starts_on=started_on,
        expires_on=expiry,
        attendance_log=attendance_log,
    )
    await subscription.insert()
    member.active_subscription_id = subscription.id
    member.gym_meta.membership_status = "active"
    member.updated_at = get_utc_now()
    await member.save()


async def seed_demo_data() -> None:
    logger.info("Connecting to MongoDB for demo data...")
    await connect_to_database()
    try:
        admin = await UserDocument.find_one(UserDocument.phone == "+919999999999")
        trainer = await UserDocument.find_one(UserDocument.phone == "+918888888888")
        if not admin or not trainer:
            raise RuntimeError("Run `python -m app.seed` first to create the Admin and Trainer.")

        active_plans, expired_plans = await ensure_plans()
        coupons = await ensure_coupons()
        for index, (full_name, phone, email, referral_code) in enumerate(DEMO_USERS):
            member = await ensure_member(full_name, phone, email, referral_code, trainer.id)
            await ensure_referral(member)
            await ensure_subscription(
                member,
                active_plans[index % len(active_plans)],
                trainer.id,
                index,
            )

        logger.info(
            "Demo data ready: {} active plans, {} archived plans, {} coupons, {} members.",
            len(active_plans),
            len(expired_plans),
            len(coupons),
            len(DEMO_USERS),
        )
    finally:
        await close_database_connection()


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
