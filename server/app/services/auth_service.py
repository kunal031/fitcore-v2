from beanie import PydanticObjectId

from app.core.exceptions import (
    AuthException,
    ConflictException,
    NotFoundException,
    ValidationException,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.referral import ReferralDocument, ReferredMember
from app.models.user import UserDocument
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserBasicInfo,
)
from app.utils.date_utils import get_utc_now
from app.utils.generators import generate_referral_code


class AuthService:
    async def register(self, payload: RegisterRequest) -> TokenResponse:
        # 1. Check if phone already registered
        existing_user = await UserDocument.find_one(UserDocument.phone == payload.phone)
        if existing_user:
            raise ConflictException(
                message="This phone number is already registered.",
                error_code="PHONE_ALREADY_EXISTS",
            )

        # 1b. Check if email already registered if provided
        if payload.email:
            clean_email = str(payload.email).strip().lower()
            existing_email = await UserDocument.find_one(
                {"email": {"$regex": f"^{clean_email}$", "$options": "i"}}
            )
            if existing_email:
                raise ConflictException(
                    message="This email address is already registered.",
                    error_code="EMAIL_ALREADY_EXISTS",
                )

        # 2. Check referral code if provided
        referrer_doc = None
        if payload.referral_code:
            clean_code = payload.referral_code.strip().upper()
            referrer_doc = await ReferralDocument.find_one(
                ReferralDocument.referral_code == clean_code,
                {"is_active": True},
            )
            if not referrer_doc:
                raise ValidationException(
                    message="The referral code provided is invalid or inactive.",
                    error_code="INVALID_REFERRAL_CODE",
                    field="referral_code",
                )

        # 3. Generate unique referral code for this new user
        new_ref_code = generate_referral_code(prefix=payload.full_name)
        while await UserDocument.find_one(UserDocument.my_referral_code == new_ref_code):
            new_ref_code = generate_referral_code(prefix=payload.full_name)

        # 4. Hash password and save new UserDocument
        hashed = hash_password(payload.password)
        new_user = UserDocument(
            phone=payload.phone,
            email=str(payload.email).strip().lower() if payload.email else None,
            hashed_password=hashed,
            full_name=payload.full_name,
            role="member",
            my_referral_code=new_ref_code,
            referred_by_code=(
                payload.referral_code.strip().upper() if payload.referral_code else None
            ),
            loyalty_points=0,
            is_active=True,
        )
        await new_user.insert()

        # 5. Create own Referral tracking document
        user_referral_doc = ReferralDocument(
            referrer_user_id=new_user.id,
            referral_code=new_ref_code,
        )
        await user_referral_doc.insert()

        # 6. If referred by someone, record in referrer's referred_members list
        if referrer_doc:
            referrer_doc.total_referrals += 1
            referrer_doc.referred_members.append(
                ReferredMember(
                    user_id=new_user.id,
                    full_name=new_user.full_name,
                    joined_on=get_utc_now(),
                    has_purchased=False,
                    reward_issued=False,
                )
            )
            await referrer_doc.save()

        # 7. Generate JWT access and refresh tokens
        access_token = create_access_token(
            user_id=str(new_user.id), role=new_user.role, token_version=new_user.token_version
        )
        refresh_token = create_refresh_token(
            user_id=str(new_user.id), token_version=new_user.token_version
        )

        return TokenResponse(
            user=UserBasicInfo(
                id=str(new_user.id),
                full_name=new_user.full_name,
                phone=new_user.phone,
                role=new_user.role,
                membership_status=new_user.gym_meta.membership_status,
            ),
            access_token=access_token,
            refresh_token=refresh_token,
        )

    async def login(self, payload: LoginRequest) -> TokenResponse:
        # 1. Resolve identifier (identifier, or phone, or email)
        raw_id = payload.identifier or payload.phone or payload.email
        if not raw_id:
            raise AuthException(
                message="Please provide either a phone number or email address.",
                error_code="IDENTIFIER_REQUIRED",
            )

        raw_id = str(raw_id).strip()
        user = None

        if "@" in raw_id:
            # Login via Email (case-insensitive)
            clean_email = raw_id.lower()
            user = await UserDocument.find_one(
                {"email": {"$regex": f"^{clean_email}$", "$options": "i"}}
            )
        else:
            # Login via Phone number
            from app.utils.formatters import format_phone
            clean_phone = format_phone(raw_id)
            user = await UserDocument.find_one(UserDocument.phone == clean_phone)

        if not user or not verify_password(payload.password, user.hashed_password):
            raise AuthException(
                message="Incorrect phone/email or password.",
                error_code="INVALID_CREDENTIALS",
            )

        if not user.is_active:
            raise AuthException(
                message="Your account has been deactivated. Please contact gym staff.",
                error_code="ACCOUNT_DEACTIVATED",
            )

        access_token = create_access_token(
            user_id=str(user.id), role=user.role, token_version=user.token_version
        )
        refresh_token = create_refresh_token(
            user_id=str(user.id), token_version=user.token_version
        )

        return TokenResponse(
            user=UserBasicInfo(
                id=str(user.id),
                full_name=user.full_name,
                phone=user.phone,
                role=user.role,
                membership_status=user.gym_meta.membership_status,
            ),
            access_token=access_token,
            refresh_token=refresh_token,
        )

    async def refresh_token(self, refresh_token_str: str) -> TokenResponse:
        payload = decode_token(refresh_token_str, expected_type="refresh")
        user_id = payload.get("sub")
        user = await UserDocument.get(PydanticObjectId(user_id))
        if not user or not user.is_active:
            raise AuthException(
                message="User account no longer active.",
                error_code="USER_NOT_FOUND",
            )

        if payload.get("ver", 0) != user.token_version:
            raise AuthException(
                message="This refresh token is no longer valid. Please log in again.",
                error_code="TOKEN_REVOKED",
            )

        new_access = create_access_token(
            user_id=str(user.id), role=user.role, token_version=user.token_version
        )
        new_refresh = create_refresh_token(
            user_id=str(user.id), token_version=user.token_version
        )

        return TokenResponse(
            user=UserBasicInfo(
                id=str(user.id),
                full_name=user.full_name,
                phone=user.phone,
                role=user.role,
                membership_status=user.gym_meta.membership_status,
            ),
            access_token=new_access,
            refresh_token=new_refresh,
        )

    async def change_password(self, user: UserDocument, payload: ChangePasswordRequest) -> None:
        if not verify_password(payload.old_password, user.hashed_password):
            raise AuthException(
                message="Current password does not match.",
                error_code="INCORRECT_CURRENT_PASSWORD",
            )
        user.hashed_password = hash_password(payload.new_password)
        user.updated_at = get_utc_now()
        await user.save()

    async def logout(self, user: UserDocument) -> None:
        user.token_version += 1
        user.updated_at = get_utc_now()
        await user.save()

    async def reset_password(self, payload: ResetPasswordRequest) -> None:
        reset_payload = decode_token(payload.reset_token, expected_type="password_reset")
        if reset_payload.get("sub") != payload.phone:
            raise AuthException(
                message="The password reset token does not match this phone number.",
                error_code="INVALID_RESET_TOKEN",
            )

        user = await UserDocument.find_one(UserDocument.phone == payload.phone)
        if not user:
            raise NotFoundException(
                message="No account found with this phone number.",
                error_code="USER_NOT_FOUND",
            )
        user.hashed_password = hash_password(payload.new_password)
        user.updated_at = get_utc_now()
        await user.save()


auth_service = AuthService()
