/**
 * User and staff management.
 *
 * Mirrors `server/app/services/user_service.py`.
 *
 * Two fields are deliberately immutable after they are first set:
 *   - phone, which is the account's identity, and has no update path at all.
 *   - email, which is rejected with EMAIL_IMMUTABLE once a value exists.
 */
import { ROLES } from "../config/constants.js";
import type {
  ListUsersQuery,
  UserCreateManualInput,
  UserProfileUpdateInput,
  UserRead,
  UserStatusUpdateInput,
} from "../dtos/user.dto.js";
import { ConflictError, NotFoundError, ValidationError } from "../errors/index.js";
import type { UserDoc } from "../models/User.js";
import { referralRepository, userRepository } from "../repositories/index.js";
import type { PaginatedData } from "../utils/apiResponse.js";
import { buildMeta } from "../utils/apiResponse.js";
import { generateReferralCode } from "../utils/generators.js";
import { toObjectId } from "../utils/objectId.js";
import { hashPassword } from "../utils/password.js";
import { toUserRead } from "./mappers/index.js";

async function generateUniqueReferralCode(fullName: string): Promise<string> {
  let code = generateReferralCode(fullName);
  // eslint-disable-next-line no-await-in-loop
  while (await userRepository.findByReferralCode(code)) {
    code = generateReferralCode(fullName);
  }
  return code;
}

export const userService = {
  /**
   * Map a user to the response shape, additionally resolving their assigned
   * trainer's name. Used by `GET /users/me`, where the profile screen shows
   * the trainer by name rather than id.
   */
  async toUserReadWithTrainer(user: UserDoc): Promise<UserRead> {
    const result = toUserRead(user);
    if (user.gym_meta.assigned_trainer_id) {
      const trainer = await userRepository.findById(user.gym_meta.assigned_trainer_id);
      if (trainer) {
        result.gym_meta.assigned_trainer_name = trainer.full_name;
      }
    }
    return result;
  },

  async getById(userId: string): Promise<UserRead> {
    const user = await userRepository.findById(
      toObjectId(userId, "User not found", "USER_NOT_FOUND"),
    );
    if (!user) {
      throw new NotFoundError("User not found", "USER_NOT_FOUND");
    }
    return toUserRead(user);
  },

  /**
   * Apply a partial profile update.
   *
   * Only keys present in the payload are touched, so a form that submits a
   * subset of fields cannot blank out the rest.
   */
  async updateProfile(
    userId: string,
    payload: UserProfileUpdateInput,
  ): Promise<UserRead> {
    const user = await userRepository.findById(
      toObjectId(userId, "User not found", "USER_NOT_FOUND"),
    );
    if (!user) {
      throw new NotFoundError("User not found", "USER_NOT_FOUND");
    }

    if (payload.full_name != null) user.full_name = payload.full_name;

    if (payload.email != null) {
      const newEmail = payload.email.trim().toLowerCase();
      // An email may be set once; changing an existing one is refused.
      if (user.email && user.email.toLowerCase() !== newEmail) {
        throw new ConflictError(
          "Email address cannot be changed after it is set.",
          "EMAIL_IMMUTABLE",
        );
      }
      user.email = newEmail;
    }

    if (payload.dob != null) user.profile.dob = payload.dob;
    if (payload.blood_group != null) user.profile.blood_group = payload.blood_group;
    if (payload.gender != null) user.profile.gender = payload.gender;
    if (payload.avatar_url != null) user.profile.avatar_url = payload.avatar_url;

    if (payload.address != null) {
      const { address } = payload;
      if (address.street != null) user.profile.address.street = address.street;
      if (address.city != null) user.profile.address.city = address.city;
      if (address.state != null) user.profile.address.state = address.state;
      if (address.pincode != null) user.profile.address.pincode = address.pincode;
    }

    await user.save();
    return this.toUserReadWithTrainer(user);
  },

  /** Paginated, filterable user list for the trainer/owner member screens. */
  async listUsers(query: ListUsersQuery): Promise<PaginatedData<UserRead>> {
    const { items, total } = await userRepository.listPaginated({
      page: query.page,
      limit: query.limit,
      search: query.search,
      role: query.role,
      membershipStatus: query.status,
    });

    return {
      items: items.map(toUserRead),
      meta: buildMeta(query.page, query.limit, total),
    };
  },

  /**
   * Create an account on someone's behalf — a walk-in member, or a new
   * trainer. Owner only.
   */
  async createUserManual(payload: UserCreateManualInput): Promise<UserRead> {
    if (await userRepository.findByPhone(payload.phone)) {
      throw new ConflictError(
        "This phone number is already registered.",
        "PHONE_ALREADY_EXISTS",
      );
    }

    const referralCode = await generateUniqueReferralCode(payload.full_name);
    const newUser = await userRepository.create({
      phone: payload.phone,
      hashed_password: await hashPassword(payload.password),
      full_name: payload.full_name,
      email: payload.email ?? null,
      role: payload.role,
      my_referral_code: referralCode,
      is_active: true,
    });

    await referralRepository.create({
      referrer_user_id: newUser._id,
      referral_code: referralCode,
    });

    return toUserRead(newUser);
  },

  /**
   * Update account or membership status. Owner only.
   *
   * Setting `is_active: false` locks the account out at the auth middleware on
   * the next request, but does not revoke tokens already issued.
   */
  async updateStatus(
    userId: string,
    payload: UserStatusUpdateInput,
  ): Promise<UserRead> {
    const user = await userRepository.findById(
      toObjectId(userId, "User not found", "USER_NOT_FOUND"),
    );
    if (!user) {
      throw new NotFoundError("User not found", "USER_NOT_FOUND");
    }

    if (payload.is_active != null) user.is_active = payload.is_active;
    if (payload.membership_status != null) {
      user.gym_meta.membership_status = payload.membership_status;
    }

    await user.save();
    return toUserRead(user);
  },

  /** Assign a trainer to a member. The target must actually hold the trainer role. */
  async assignTrainer(memberId: string, trainerId: string): Promise<UserRead> {
    const member = await userRepository.findById(
      toObjectId(memberId, "Member not found", "MEMBER_NOT_FOUND"),
    );
    if (!member) {
      throw new NotFoundError("Member not found", "MEMBER_NOT_FOUND");
    }

    const trainer = await userRepository.findById(
      toObjectId(trainerId, "Assigned user must be a valid trainer", "INVALID_TRAINER"),
    );
    if (!trainer || trainer.role !== ROLES.TRAINER) {
      throw new ValidationError(
        "Assigned user must be a valid trainer",
        "INVALID_TRAINER",
      );
    }

    member.gym_meta.assigned_trainer_id = trainer._id;
    await member.save();
    return toUserRead(member);
  },

  async listTrainers(): Promise<UserRead[]> {
    const trainers = await userRepository.listActiveTrainers();
    return trainers.map(toUserRead);
  },
};
