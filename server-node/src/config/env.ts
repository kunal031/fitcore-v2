/**
 * Environment configuration.
 *
 * Mirrors `server/app/core/config.py`. Values are read once at startup and
 * validated, so a misconfigured deployment fails immediately rather than on
 * the first request that happens to need the missing key.
 */
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const envSchema = z.object({
  // ── Application ──────────────────────────────────────────────────────────
  ENVIRONMENT: z.string().default("development"),
  LOG_LEVEL: z.string().default("debug"),
  PORT: z.coerce.number().int().positive().default(8000),

  // ── MongoDB ──────────────────────────────────────────────────────────────
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  DATABASE_NAME: z.string().default("fitcore_db"),

  // ── JWT ──────────────────────────────────────────────────────────────────
  JWT_SECRET_KEY: z.string().min(1, "JWT_SECRET_KEY is required"),
  JWT_ALGORITHM: z.literal("HS256").default("HS256"),
  ACCESS_TOKEN_EXPIRE_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_EXPIRE_DAYS: z.coerce.number().int().positive().default(30),

  // ── Razorpay ─────────────────────────────────────────────────────────────
  RAZORPAY_KEY_ID: z.string().min(1, "RAZORPAY_KEY_ID is required"),
  RAZORPAY_KEY_SECRET: z.string().min(1, "RAZORPAY_KEY_SECRET is required"),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(""),

  // ── CORS ─────────────────────────────────────────────────────────────────
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const env = parsed.data;

export const settings = {
  ...env,

  /** CORS_ORIGINS is stored as a comma-separated string; split it for the middleware. */
  get corsOriginsList(): string[] {
    return env.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  },

  get isProduction(): boolean {
    return env.ENVIRONMENT === "production";
  },

  /**
   * The Python server treats the placeholder key from `.env.example` as a
   * signal to run the gateway in mock mode. Keeping the same check means a
   * developer's existing .env behaves identically here.
   */
  get isRazorpayMocked(): boolean {
    return (
      env.RAZORPAY_KEY_ID.startsWith("rzp_test_xxxx") ||
      env.RAZORPAY_KEY_SECRET.startsWith("your_")
    );
  },
} as const;

export type Settings = typeof settings;
