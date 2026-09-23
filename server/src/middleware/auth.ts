/**
 * Authentication and role guards.
 *
 * Mirrors `server/app/middleware/auth.py`. `requireAuth` resolves the Bearer
 * token to a live user document; the role guards run after it.
 */
import type { NextFunction, Request, Response } from "express";

import { ROLES, TOKEN_TYPE, type Role } from "../config/constants.js";
import { AuthError, ForbiddenError } from "../errors/index.js";
import { User, type UserDoc } from "../models/User.js";
import { decodeToken, type AccessTokenPayload } from "../utils/jwt.js";
import { isValidObjectId } from "../utils/objectId.js";
import { asyncHandler } from "./asyncHandler.js";

/** Pull the token out of an `Authorization: Bearer <token>` header. */
function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) return null;
  return token.trim() || null;
}

/**
 * Validate the access token and attach the user to the request.
 *
 * Rejects, in order: a missing header, an invalid or expired token, an unknown
 * user, a deactivated account, and a token whose `ver` no longer matches the
 * user's `token_version` (i.e. issued before the last logout).
 */
export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (!token) {
      throw new AuthError(
        "Authentication credentials were not provided.",
        "CREDENTIALS_MISSING",
      );
    }

    const payload = decodeToken<AccessTokenPayload>(token, TOKEN_TYPE.ACCESS);

    if (!payload.sub || !isValidObjectId(payload.sub)) {
      throw new AuthError("Malformed authentication token.", "INVALID_TOKEN");
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw new AuthError(
        "User associated with token no longer exists.",
        "USER_NOT_FOUND",
      );
    }

    if (!user.is_active) {
      throw new ForbiddenError(
        "Your account is deactivated. Contact gym management.",
        "ACCOUNT_DEACTIVATED",
      );
    }

    if ((payload.ver ?? 0) !== user.token_version) {
      throw new AuthError(
        "This access token is no longer valid. Please log in again.",
        "TOKEN_REVOKED",
      );
    }

    req.user = user;
    next();
  },
);

/**
 * The authenticated user, for handlers running behind `requireAuth`.
 *
 * Throws rather than returning undefined, so a guard accidentally omitted from
 * a route becomes a loud 401 instead of a silent undefined dereference.
 */
export function currentUser(req: Request): UserDoc {
  if (!req.user) {
    throw new AuthError(
      "Authentication credentials were not provided.",
      "CREDENTIALS_MISSING",
    );
  }
  return req.user;
}

/** Build a guard that admits only the listed roles. */
function requireRoles(roles: Role[], message: string, errorCode: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = currentUser(req);
    if (!roles.includes(user.role as Role)) {
      next(new ForbiddenError(message, errorCode));
      return;
    }
    next();
  };
}

/** Owner only. Displayed as "Admin" in the frontend. */
export const requireOwner = requireRoles(
  [ROLES.OWNER],
  "Access denied: Owner privileges required.",
  "OWNER_ROLE_REQUIRED",
);

/** Staff: trainer or owner. */
export const requireTrainerOrOwner = requireRoles(
  [ROLES.OWNER, ROLES.TRAINER],
  "Access denied: Trainer or Owner privileges required.",
  "STAFF_ROLE_REQUIRED",
);

/** Member only. Staff accounts are deliberately excluded from member routes. */
export const requireMember = requireRoles(
  [ROLES.MEMBER],
  "Access denied: Member privileges required.",
  "MEMBER_ROLE_REQUIRED",
);
