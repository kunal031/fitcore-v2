/**
 * JWT creation and verification.
 *
 * Mirrors `server/app/core/security.py`. Three token types are issued:
 *
 *   access          — carries `sub`, `role` and `ver`; short-lived.
 *   refresh         — carries `sub` and `ver` but deliberately no role, so a
 *                     role change cannot be replayed from an old refresh token.
 *   password_reset  — carries the phone number in `sub`; issued only after a
 *                     successful OTP verification.
 *
 * `ver` is the user's `token_version`. Logout increments it, which invalidates
 * every token issued before that point.
 */
import jwt, { type JwtPayload } from "jsonwebtoken";

import { settings } from "../config/env.js";
import { PASSWORD_RESET_TOKEN_EXPIRY_MINUTES, TOKEN_TYPE, type TokenType } from "../config/constants.js";
import { AuthError } from "../errors/index.js";

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: string;
  ver: number;
  type: typeof TOKEN_TYPE.ACCESS;
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  ver: number;
  type: typeof TOKEN_TYPE.REFRESH;
}

export interface PasswordResetTokenPayload extends JwtPayload {
  sub: string;
  type: typeof TOKEN_TYPE.PASSWORD_RESET;
}

export type AnyTokenPayload =
  | AccessTokenPayload
  | RefreshTokenPayload
  | PasswordResetTokenPayload;

const signOptions = { algorithm: settings.JWT_ALGORITHM } as const;

/** Short-lived access token. Default lifetime: 15 minutes. */
export function createAccessToken(
  userId: string,
  role: string,
  tokenVersion = 0,
): string {
  return jwt.sign(
    { sub: userId, role, ver: tokenVersion, type: TOKEN_TYPE.ACCESS },
    settings.JWT_SECRET_KEY,
    { ...signOptions, expiresIn: `${settings.ACCESS_TOKEN_EXPIRE_MINUTES}m` },
  );
}

/** Long-lived refresh token. Default lifetime: 30 days. Contains no role. */
export function createRefreshToken(userId: string, tokenVersion = 0): string {
  return jwt.sign(
    { sub: userId, ver: tokenVersion, type: TOKEN_TYPE.REFRESH },
    settings.JWT_SECRET_KEY,
    { ...signOptions, expiresIn: `${settings.REFRESH_TOKEN_EXPIRE_DAYS}d` },
  );
}

/** Password recovery token, bound to a phone number. Lifetime: 10 minutes. */
export function createPasswordResetToken(phone: string): string {
  return jwt.sign(
    { sub: phone, type: TOKEN_TYPE.PASSWORD_RESET },
    settings.JWT_SECRET_KEY,
    { ...signOptions, expiresIn: `${PASSWORD_RESET_TOKEN_EXPIRY_MINUTES}m` },
  );
}

/**
 * Decode and validate a token, asserting it is of the expected type.
 *
 * Throws `AuthError` — never a raw jsonwebtoken error — so the global handler
 * renders it in the standard envelope.
 */
export function decodeToken<T extends AnyTokenPayload = AnyTokenPayload>(
  token: string,
  expectedType: TokenType = TOKEN_TYPE.ACCESS,
): T {
  let payload: JwtPayload;
  try {
    const decoded = jwt.verify(token, settings.JWT_SECRET_KEY, {
      algorithms: [settings.JWT_ALGORITHM],
    });
    if (typeof decoded === "string") {
      throw new Error("Unexpected string payload");
    }
    payload = decoded;
  } catch {
    throw new AuthError(
      "Invalid or expired token. Please log in again.",
      "INVALID_TOKEN",
    );
  }

  const tokenType = payload["type"] as string | undefined;
  if (tokenType !== expectedType) {
    throw new AuthError(
      `Expected a ${expectedType} token but received a ${tokenType} token.`,
      "WRONG_TOKEN_TYPE",
    );
  }

  if (!payload.sub) {
    throw new AuthError("Token is missing user identity.", "INVALID_TOKEN");
  }

  return payload as T;
}
