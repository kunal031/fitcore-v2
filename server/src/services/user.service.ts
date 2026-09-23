/**
 * User and staff management.
 *
 * Mirrors `server/app/services/user_service.py`.
 *
 * Two fields are deliberately immutable after they are first set:
 *   - phone, which is the account's identity, and has no update path at all.
 *   - email, which is rejected with EMAIL_IMMUTABLE once a value exists.
 */
import { ROLES, TRAINER_VISIBILITY } from "../config/constants.js";
import type {
  ListUsersQuery,
  MemberSubscriptionSummary,
  UserCreateManualInput,
  UserProfileUpdateInput,
  UserRead,
  UserStatusUpdateInput,
} from "../dtos/user.dto.js";
import { ConflictError, NotFoundError, ValidationError } from "../errors/index.js";
import type { UserDoc } from "../models/User.js";
import {
  referralRepository,
  subscriptionRepository,
  userRepository,
} from "../repositories/index.js";
import type { PaginatedData } from "../utils/apiResponse.js";
import { buildMeta } from "../utils/apiResponse.js";
import { generateReferralCode } from "../utils/generators.js";
import { toObjectId } from "../utils/objectId.js";
import { hashPassword } from "../utils/password.js";
import { daysBetween, getTodayStr, toCalendarDateStr } from "../utils/date.js";
import { toUserRead } from "./mappers/index.js";
import { settingService } from "./setting.service.js";

/** The member list, plus which scope the caller was served. */
export interface ListUsersData extends PaginatedData<UserRead> {
  /** "all" or "assigned" — what this caller actually got. */
  scope: string;
}

async function generateUniqueReferralCode(fullName: string): Promise<string> {
  let code = generateReferralCode(fullName);
  // eslint-disable-next-line no-await-in-loop
  while (await userRepository.findByReferralCode(code)) {
    code = generateReferralCode(fullName);
  }
  return code;
}

/**
 * Fill `assigned_trainer_name` across a page of users in one query.
 *
 * Previously hardcoded null on every list row, so the member table could show
 * an id but never a name.
 */
async function resolveTrainerNames(
  docs: UserDoc[],
  mapped: UserRead[],
): Promise<void> {
  const trainerIds = docs
    .map((doc) => doc.gym_meta.assigned_trainer_id)
    .filter((id): id is NonNullable<typeof id> => id != null);
  if (trainerIds.length === 0) return;

  const names = await userRepository.findNamesByIds(trainerIds);
  for (const row of mapped) {
    if (!row.gym_meta.assigned_trainer_id) continue;
    row.gym_meta.assigned_trainer_name =
      names.get(row.gym_meta.assigned_trainer_id) ?? null;
  }
}

/** Fold each member's current plan into their row, in one batched query. */
async function attachSubscriptions(
  docs: UserDoc[],
  mapped: UserRead[],
): Promise<void> {
  const latest = await subscriptionRepository.findLatestByUserIds(
    docs.map((doc) => String(doc._id)),
  );
  const today = getTodayStr();

  for (const row of mapped) {
    const sub = latest.get(row.id);
    if (!sub) {
      // Explicitly null rather than absent, so the client can tell "no plan"
      // from "the list was not asked for plans".
      row.subscription = null;
      continue;
    }

    // Stored two ways; normalise before any date arithmetic.
    const expiresOn = toCalendarDateStr(sub.expires_on) ?? today;
    row.subscription = {
      subscription_id: String(sub._id),
      plan_name: sub.plan_snapshot.plan_name,
      status: sub.status,
      days_remaining: sub.days_remaining,
      days_until_expiry: Math.max(0, daysBetween(today, expiresOn)),
      expires_on: expiresOn,
    } satisfies MemberSubscriptionSummary;
  }
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

  /**
   * Paginated, filterable user list for the trainer/owner member screens.
   *
   * A trainer sees only the members assigned to them, unless the gym's
   * visibility policy widens that — see `settingService.trainerSeesAllMembers`.
   * The scoping is applied here rather than trusted from the query, so a
   * trainer cannot widen their own view by passing a different trainer id.
   *
   * `scope` reports which of the two the caller got, so the UI can say
   * "showing your assigned members" instead of leaving an empty list looking
   * like a failure. It never reveals the policy itself.
   */
  async listUsers(
    query: ListUsersQuery,
    caller: UserDoc,
  ): Promise<ListUsersData> {
    const isTrainer = caller.role === ROLES.TRAINER;
    const seesAll =
      !isTrainer || (await settingService.trainerSeesAllMembers(String(caller._id)));

    // A trainer who is not exempt is pinned to their own id; anyone else may
    // filter by whichever trainer they asked for, or not at all.
    const assignedTrainerId = isTrainer && !seesAll
      ? String(caller._id)
      : query.assigned_trainer_id;

    const { items, total } = await userRepository.listPaginated({
      page: query.page,
      limit: query.limit,
      search: query.search,
      role: query.role,
      membershipStatus: query.status,
      assignedTrainerId,
    });

    const mapped = items.map(toUserRead);

    // Both enrichments are batched: one query for every trainer named on the
    // page, one for every subscription, rather than a lookup per row.
    await Promise.all([
      resolveTrainerNames(items, mapped),
      query.include === "subscription"
        ? attachSubscriptions(items, mapped)
        : Promise.resolve(),
    ]);

    return {
      items: mapped,
      meta: buildMeta(query.page, query.limit, total),
      scope: seesAll ? TRAINER_VISIBILITY.ALL : TRAINER_VISIBILITY.ASSIGNED,
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
