/**
 * Authentication: registration, login, token refresh, logout and password
 * recovery.
 *
 * Mirrors `server/app/services/auth_service.py`.
 *
 * Session invalidation works through `token_version`: it is embedded in every
 * token as `ver`, and logout increments the stored value, which retires every
 * token issued before that moment without needing a denylist.
 */
import { ROLES, TOKEN_TYPE } from "../config/constants.js";
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  TokenResponse,
  UserBasicInfo,
} from "../dtos/auth.dto.js";
import { AuthError, ConflictError, NotFoundError, ValidationError } from "../errors/index.js";
import type { UserDoc } from "../models/User.js";
import { referralRepository, userRepository } from "../repositories/index.js";
import { getUtcNow } from "../utils/date.js";
import { generateReferralCode } from "../utils/generators.js";
import {
  createAccessToken,
  createRefreshToken,
  decodeToken,
  type PasswordResetTokenPayload,
  type RefreshTokenPayload,
} from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

/** The compact user object embedded in every token response. */
function toUserBasicInfo(user: UserDoc): UserBasicInfo {
  return {
    id: String(user._id),
    full_name: user.full_name,
    phone: user.phone,
    role: user.role,
    membership_status: user.gym_meta.membership_status,
  };
}

/** Issue a fresh access/refresh pair for a user. */
function issueTokens(user: UserDoc): TokenResponse {
  return {
    user: toUserBasicInfo(user),
    access_token: createAccessToken(String(user._id), user.role, user.token_version),
    refresh_token: createRefreshToken(String(user._id), user.token_version),
    token_type: "bearer",
  };
}

/**
 * Generate a referral code that no existing user holds.
 *
 * Collisions are rare but possible, so the code is regenerated until free.
 * The unique index remains the real guarantee.
 */
async function generateUniqueReferralCode(fullName: string): Promise<string> {
  let code = generateReferralCode(fullName);
  // eslint-disable-next-line no-await-in-loop
  while (await userRepository.findByReferralCode(code)) {
    code = generateReferralCode(fullName);
  }
  return code;
}

export const authService = {
  /**
   * Register a new member.
   *
   * Beyond creating the account this also creates the member's own referral
   * record, and — when they signed up through someone's code — appends them to
   * that referrer's list. No reward is issued yet; that happens on their first
   * successful payment.
   */
  async register(payload: RegisterInput): Promise<TokenResponse> {
    // 1. Phone is the primary identity and must be free.
    if (await userRepository.findByPhone(payload.phone)) {
      throw new ConflictError(
        "This phone number is already registered.",
        "PHONE_ALREADY_EXISTS",
      );
    }

    // 2. Email, when given, must also be unused.
    if (payload.email && (await userRepository.findByEmail(payload.email))) {
      throw new ConflictError(
        "This email address is already registered.",
        "EMAIL_ALREADY_EXISTS",
      );
    }

    // 3. A supplied referral code must resolve to an active referral record.
    let referrerDoc = null;
    if (payload.referral_code) {
      const cleanCode = payload.referral_code.trim().toUpperCase();
      referrerDoc = await referralRepository.findActiveByCode(cleanCode);
      if (!referrerDoc) {
        throw new ValidationError(
          "The referral code provided is invalid or inactive.",
          "INVALID_REFERRAL_CODE",
          "referral_code",
        );
      }
    }

    // 4. Create the account.
    const newReferralCode = await generateUniqueReferralCode(payload.full_name);
    const newUser = await userRepository.create({
      phone: payload.phone,
      email: payload.email ?? null,
      hashed_password: await hashPassword(payload.password),
      full_name: payload.full_name,
      role: ROLES.MEMBER,
      my_referral_code: newReferralCode,
      referred_by_code: payload.referral_code
        ? payload.referral_code.trim().toUpperCase()
        : null,
      loyalty_points: 0,
      is_active: true,
    });

    // 5. Every member gets their own referral record so they can refer others.
    await referralRepository.create({
      referrer_user_id: newUser._id,
      referral_code: newReferralCode,
    });

    // 6. Record the signup against the referrer.
    if (referrerDoc) {
      referrerDoc.total_referrals += 1;
      referrerDoc.referred_members.push({
        user_id: newUser._id,
        full_name: newUser.full_name,
        joined_on: getUtcNow(),
        has_purchased: false,
        reward_issued: false,
      });
      await referrerDoc.save();
    }

    return issueTokens(newUser);
  },

  /**
   * Log in with either a phone number or an email address.
   *
   * The same error is returned for an unknown identifier and a wrong password,
   * so the response cannot be used to enumerate registered accounts.
   */
  async login(payload: LoginInput): Promise<TokenResponse> {
    const identifier = payload.identifier.trim();

    const user = identifier.includes("@")
      ? await userRepository.findByEmail(identifier)
      : await userRepository.findByPhone(identifier);

    if (!user || !(await verifyPassword(payload.password, user.hashed_password))) {
      throw new AuthError(
        "Incorrect phone/email or password.",
        "INVALID_CREDENTIALS",
      );
    }

    if (!user.is_active) {
      throw new AuthError(
        "Your account has been deactivated. Please contact gym staff.",
        "ACCOUNT_DEACTIVATED",
      );
    }

    return issueTokens(user);
  },

  /**
   * Exchange a refresh token for a new pair.
   *
   * The role is read from the database rather than the token, so a role change
   * takes effect on the next refresh.
   */
  async refreshToken(refreshTokenStr: string): Promise<TokenResponse> {
    const payload = decodeToken<RefreshTokenPayload>(
      refreshTokenStr,
      TOKEN_TYPE.REFRESH,
    );

    const user = await userRepository.findById(payload.sub);
    if (!user || !user.is_active) {
      throw new AuthError("User account no longer active.", "USER_NOT_FOUND");
    }

    if ((payload.ver ?? 0) !== user.token_version) {
      throw new AuthError(
        "This refresh token is no longer valid. Please log in again.",
        "TOKEN_REVOKED",
      );
    }

    return issueTokens(user);
  },

  /** Change a password for a signed-in user, after confirming the current one. */
  async changePassword(user: UserDoc, payload: ChangePasswordInput): Promise<void> {
    if (!(await verifyPassword(payload.old_password, user.hashed_password))) {
      throw new AuthError(
        "Current password does not match.",
        "INCORRECT_CURRENT_PASSWORD",
      );
    }
    user.hashed_password = await hashPassword(payload.new_password);
    await user.save();
  },

  /** Log out by retiring every token issued to this user so far. */
  async logout(user: UserDoc): Promise<void> {
    user.token_version += 1;
    await user.save();
  },

  /**
   * Complete a password reset using the token issued by `verify-otp`.
   *
   * The token's subject must match the phone number in the request, so a token
   * minted for one account cannot reset another.
   */
  async resetPassword(payload: ResetPasswordInput): Promise<void> {
    const resetPayload = decodeToken<PasswordResetTokenPayload>(
      payload.reset_token,
      TOKEN_TYPE.PASSWORD_RESET,
    );

    if (resetPayload.sub !== payload.phone) {
      throw new AuthError(
        "The password reset token does not match this phone number.",
        "INVALID_RESET_TOKEN",
      );
    }

    const user = await userRepository.findByPhone(payload.phone);
    if (!user) {
      throw new NotFoundError(
        "No account found with this phone number.",
        "USER_NOT_FOUND",
      );
    }

    user.hashed_password = await hashPassword(payload.new_password);
    await user.save();
  },
};
