from typing import List, Optional

from beanie import PydanticObjectId

from app.core.exceptions import ConflictException, NotFoundException, ValidationException
from app.core.security import hash_password
from app.models.referral import ReferralDocument
from app.models.user import UserDocument
from app.schemas.common import PaginatedData, PaginatedMeta
from app.schemas.user import (
    AddressRead,
    GymMetaRead,
    ProfileRead,
    UserCreateManual,
    UserProfileUpdate,
    UserRead,
    UserStatusUpdate,
)
from app.utils.date_utils import get_utc_now
from app.utils.generators import generate_referral_code


class UserService:
    @staticmethod
    def to_user_read(user: UserDocument) -> UserRead:
        addr = user.profile.address
        return UserRead(
            id=str(user.id),
            full_name=user.full_name,
            phone=user.phone,
            email=user.email,
            role=user.role,
            profile=ProfileRead(
                dob=user.profile.dob,
                blood_group=user.profile.blood_group,
                gender=user.profile.gender,
                avatar_url=user.profile.avatar_url,
                address=AddressRead(
                    street=addr.street,
                    city=addr.city,
                    state=addr.state,
                    pincode=addr.pincode,
                ),
            ),
            gym_meta=GymMetaRead(
                joined_on=user.gym_meta.joined_on,
                membership_status=user.gym_meta.membership_status,
                assigned_trainer_id=str(user.gym_meta.assigned_trainer_id)
                if user.gym_meta.assigned_trainer_id
                else None,
            ),
            active_subscription_id=str(user.active_subscription_id)
            if user.active_subscription_id
            else None,
            my_referral_code=user.my_referral_code,
            loyalty_points=user.loyalty_points,
            is_active=user.is_active,
        )

    async def to_user_read_with_trainer(self, user: UserDocument) -> UserRead:
        result = self.to_user_read(user)
        if user.gym_meta.assigned_trainer_id:
            trainer = await UserDocument.get(user.gym_meta.assigned_trainer_id)
            if trainer:
                result.gym_meta.assigned_trainer_name = trainer.full_name
        return result

    async def get_by_id(self, user_id: str) -> UserRead:
        user = await UserDocument.get(PydanticObjectId(user_id))
        if not user:
            raise NotFoundException(message="User not found", error_code="USER_NOT_FOUND")
        return self.to_user_read(user)

    async def update_profile(self, user_id: str, payload: UserProfileUpdate) -> UserRead:
        user = await UserDocument.get(PydanticObjectId(user_id))
        if not user:
            raise NotFoundException(message="User not found", error_code="USER_NOT_FOUND")

        if payload.full_name is not None:
            user.full_name = payload.full_name
        if payload.email is not None:
            new_email = str(payload.email).strip().lower()
            if user.email and user.email.lower() != new_email:
                raise ConflictException(
                    message="Email address cannot be changed after it is set.",
                    error_code="EMAIL_IMMUTABLE",
                    )
            user.email = new_email
        if payload.dob is not None:
            user.profile.dob = payload.dob
        if payload.blood_group is not None:
            user.profile.blood_group = payload.blood_group
        if payload.gender is not None:
            user.profile.gender = payload.gender
        if payload.avatar_url is not None:
            user.profile.avatar_url = payload.avatar_url
        if payload.address is not None:
            if payload.address.street is not None:
                user.profile.address.street = payload.address.street
            if payload.address.city is not None:
                user.profile.address.city = payload.address.city
            if payload.address.state is not None:
                user.profile.address.state = payload.address.state
            if payload.address.pincode is not None:
                user.profile.address.pincode = payload.address.pincode

        user.updated_at = get_utc_now()
        await user.save()
        return await self.to_user_read_with_trainer(user)

    async def list_users(
        self,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        role: Optional[str] = None,
        membership_status: Optional[str] = None,
    ) -> PaginatedData[UserRead]:
        query = {}
        if role:
            query["role"] = role
        if membership_status:
            query["gym_meta.membership_status"] = membership_status
        if search:
            query["$or"] = [
                {"full_name": {"$regex": search, "$options": "i"}},
                {"phone": {"$regex": search, "$options": "i"}},
            ]

        total = await UserDocument.find(query).count()
        skip = (page - 1) * limit
        users = await UserDocument.find(query).skip(skip).limit(limit).sort("-created_at").to_list()

        items = [self.to_user_read(u) for u in users]
        pages = (total + limit - 1) // limit if limit > 0 else 1

        return PaginatedData(
            items=items,
            meta=PaginatedMeta(page=page, limit=limit, total=total, pages=pages),
        )

    async def create_user_manual(self, payload: UserCreateManual) -> UserRead:
        existing = await UserDocument.find_one(UserDocument.phone == payload.phone)
        if existing:
            raise ConflictException(
                message="This phone number is already registered.",
                error_code="PHONE_ALREADY_EXISTS",
            )

        ref_code = generate_referral_code(prefix=payload.full_name)
        while await UserDocument.find_one(UserDocument.my_referral_code == ref_code):
            ref_code = generate_referral_code(prefix=payload.full_name)

        hashed = hash_password(payload.password)
        new_user = UserDocument(
            phone=payload.phone,
            hashed_password=hashed,
            full_name=payload.full_name,
            email=payload.email,
            role=payload.role,
            my_referral_code=ref_code,
            is_active=True,
        )
        await new_user.insert()

        ref_doc = ReferralDocument(
            referrer_user_id=new_user.id,
            referral_code=ref_code,
        )
        await ref_doc.insert()

        return self.to_user_read(new_user)

    async def update_status(self, user_id: str, payload: UserStatusUpdate) -> UserRead:
        user = await UserDocument.get(PydanticObjectId(user_id))
        if not user:
            raise NotFoundException("User not found", "USER_NOT_FOUND")

        if payload.is_active is not None:
            user.is_active = payload.is_active
        if payload.membership_status is not None:
            user.gym_meta.membership_status = payload.membership_status

        user.updated_at = get_utc_now()
        await user.save()
        return self.to_user_read(user)

    async def assign_trainer(self, member_id: str, trainer_id: str) -> UserRead:
        member = await UserDocument.get(PydanticObjectId(member_id))
        if not member:
            raise NotFoundException("Member not found", "MEMBER_NOT_FOUND")

        trainer = await UserDocument.get(PydanticObjectId(trainer_id))
        if not trainer or trainer.role != "trainer":
            raise ValidationException("Assigned user must be a valid trainer", "INVALID_TRAINER")

        member.gym_meta.assigned_trainer_id = trainer.id
        member.updated_at = get_utc_now()
        await member.save()
        return self.to_user_read(member)

    async def list_trainers(self) -> List[UserRead]:
        trainers = await UserDocument.find(
            UserDocument.role == "trainer",
            {"is_active": True},
        ).to_list()
        return [self.to_user_read(t) for t in trainers]


user_service = UserService()
