/**
 * Rate limiting.
 *
 * Mirrors the slowapi configuration: 200 requests per minute keyed on client
 * IP. Auth endpoints get a tighter limit because they are the ones worth
 * brute-forcing.
 */
import rateLimit from "express-rate-limit";

import { failure } from "../utils/apiResponse.js";

const rateLimitBody = failure(
  "RATE_LIMITED",
  "Too many requests. Please slow down.",
);

/** Global default applied to every route: 200/minute. */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitBody,
});

/**
 * Tighter limit for credential endpoints (login, register, OTP): 20/minute.
 * Successful requests still count, so a scripted attempt is throttled either
 * way.
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitBody,
});
