import asyncio
from datetime import datetime, timedelta, timezone
from loguru import logger

from app.core.database import close_database_connection, connect_to_database
from app.core.security import hash_password
from app.models.coupon import CouponDocument
from app.models.plan import PlanDocument
from app.models.referral import ReferralDocument
from app.models.user import (
    AddressSubdocument,
    GymMetaSubdocument,
    UserDocument,
    UserProfileSubdocument,
)
from app.utils.date_utils import get_utc_now


async def ensure_referral(user: UserDocument, referral_code: str) -> None:
    """Create a seed referral only when neither its user nor code already exists."""
    existing = await ReferralDocument.find_one(
        {"$or": [{"referrer_user_id": user.id}, {"referral_code": referral_code}]}
    )
    if not existing:
        await ReferralDocument(
            referrer_user_id=user.id,
            referral_code=referral_code,
        ).insert()


async def seed_database():
    logger.info("Connecting to MongoDB for database seeding...")
    await connect_to_database()

    # ── 1. Master Owner / Admin ───────────────────────────────────────────────
    owner_phone = "+919999999999"
    owner = await UserDocument.find_one(UserDocument.phone == owner_phone)
    if not owner:
        owner = UserDocument(
            phone=owner_phone,
            hashed_password=hash_password("Owner@123"),
            role="owner",
            full_name="Master Admin (Owner)",
            email="owner@fitcore.in",
            profile=UserProfileSubdocument(
                gender="male",
                address=AddressSubdocument(city="Mumbai", state="Maharashtra", pincode="400001"),
            ),
            gym_meta=GymMetaSubdocument(membership_status="active"),
            my_referral_code="OWNER001",
            is_active=True,
        )
        await owner.insert()
        logger.info(f"Created Master Owner: {owner.full_name} ({owner_phone}) / Owner@123")
    else:
        logger.info(f"Master Owner already exists ({owner_phone}).")
    await ensure_referral(owner, "OWNER001")

    # ── 2. Sample Trainer ─────────────────────────────────────────────────────
    trainer_phone = "+918888888888"
    trainer = await UserDocument.find_one(UserDocument.phone == trainer_phone)
    if not trainer:
        trainer = UserDocument(
            phone=trainer_phone,
            hashed_password=hash_password("Trainer@123"),
            role="trainer",
            full_name="Trainer Vikram",
            email="vikram@fitcore.in",
            profile=UserProfileSubdocument(
                gender="male",
                address=AddressSubdocument(city="Pune", state="Maharashtra", pincode="411045"),
            ),
            gym_meta=GymMetaSubdocument(membership_status="active"),
            my_referral_code="TRAINER01",
            is_active=True,
        )
        await trainer.insert()
        logger.info(f"Created Sample Trainer: {trainer.full_name} ({trainer_phone}) / Trainer@123")
    else:
        logger.info(f"Sample Trainer already exists ({trainer_phone}).")
    await ensure_referral(trainer, "TRAINER01")

    # ── 3. Sample Member ──────────────────────────────────────────────────────
    member_phone = "+917777777777"
    member = await UserDocument.find_one(UserDocument.phone == member_phone)
    if not member:
        member = UserDocument(
            phone=member_phone,
            hashed_password=hash_password("Member@123"),
            role="member",
            full_name="Arjun Patil (Sample Member)",
            email="arjun@example.com",
            profile=UserProfileSubdocument(
                gender="male",
                blood_group="B+",
                address=AddressSubdocument(city="Pune", state="Maharashtra", pincode="411045"),
            ),
            gym_meta=GymMetaSubdocument(membership_status="inactive", assigned_trainer_id=trainer.id if trainer else None),
            my_referral_code="ARJUN001",
            is_active=True,
        )
        await member.insert()
        logger.info(f"Created Sample Member: {member.full_name} ({member_phone}) / Member@123")
    else:
        logger.info(f"Sample Member already exists ({member_phone}).")
    await ensure_referral(member, "ARJUN001")

    # ── 4. Initial Fitness Plans ──────────────────────────────────────────────
    default_plans = [
        {
            "plan_name": "Silver Monthly",
            "description": "Standard gym access with cardio and weight training.",
            "category": "basic",
            "price_paise": 120000,  # ₹1,200
            "calendar_days": 30,
            "allocated_days": 26,
            "features": ["General Equipment Access", "Locker Room", "Cardio Zone"],
        },
        {
            "plan_name": "Gold Monthly",
            "description": "Premium access including steam bath and 1 trainer guidance session per week.",
            "category": "standard",
            "price_paise": 150000,  # ₹1,500
            "calendar_days": 30,
            "allocated_days": 26,
            "features": ["Full Equipment Access", "Steam Bath", "Weekly Trainer Guidance", "Locker Room"],
        },
        {
            "plan_name": "Platinum Annual",
            "description": "Year-round unrestricted membership with nutrition consultation and personalized workout plan.",
            "category": "premium",
            "price_paise": 1200000,  # ₹12,000
            "calendar_days": 365,
            "allocated_days": 312,
            "features": ["365 Days Access", "Personalized Workout Plan", "Diet & Nutrition Consultation", "All VIP Amenities"],
        },
    ]

    for p_data in default_plans:
        existing_plan = await PlanDocument.find_one(PlanDocument.plan_name == p_data["plan_name"])
        if not existing_plan:
            new_plan = PlanDocument(**p_data, is_active=True)
            await new_plan.insert()
            logger.info(f"Created Plan: {p_data['plan_name']} (₹{p_data['price_paise']//100})")

    # ── 5. Initial Coupons ────────────────────────────────────────────────────
    now = get_utc_now()
    default_coupons = [
        {
            "code": "WELCOME10",
            "name": "New Member Welcome Offer",
            "description": "Get 10% discount on any monthly or annual gym plan.",
            "discount_type": "percentage",
            "discount_value": 10,
            "min_plan_price_paise": 100000,
            "max_discount_paise": 20000,  # Max ₹200 off
            "max_uses": 500,
            "per_user_limit": 1,
            "valid_from": now,
            "valid_until": now + timedelta(days=90),
        },
        {
            "code": "FESTIVE20",
            "name": "Festive Season Flat Discount",
            "description": "Flat ₹200 discount for the ongoing festival season.",
            "discount_type": "flat_paise",
            "discount_value": 20000,  # Flat ₹200 off
            "min_plan_price_paise": 120000,
            "max_uses": 200,
            "per_user_limit": 1,
            "valid_from": now,
            "valid_until": now + timedelta(days=30),
        },
    ]

    for c_data in default_coupons:
        existing_coupon = await CouponDocument.find_one(CouponDocument.code == c_data["code"])
        if not existing_coupon:
            new_coupon = CouponDocument(**c_data, is_active=True)
            await new_coupon.insert()
            logger.info(f"Created Coupon: {c_data['code']}")

    logger.info("Database seeding completed successfully.")
    await close_database_connection()


if __name__ == "__main__":
    asyncio.run(seed_database())
