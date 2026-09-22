/**
 * Global error handling.
 *
 * Converts every thrown error into the standard response envelope, matching
 * the FastAPI exception handlers in `server/app/main.py`. Nothing else in the
 * codebase formats an error response.
 */
import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";

import { AppError } from "../errors/index.js";
import { failure } from "../utils/apiResponse.js";
import { logger } from "../utils/logger.js";

/** 404 for any route that matched nothing. */
export function notFoundHandler(req: Request, res: Response): void {
  res
    .status(404)
    .json(failure("ROUTE_NOT_FOUND", `No route matches ${req.method} ${req.path}.`));
}

/**
 * Terminal error handler.
 *
 * Express identifies this by its four-parameter signature, so `next` must stay
 * in the list even though it is unused.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ── Known business errors ────────────────────────────────────────────────
  if (err instanceof AppError) {
    res
      .status(err.statusCode)
      .json(failure(err.errorCode, err.message, err.field ?? null));
    return;
  }

  // ── Request body/query failed schema validation ──────────────────────────
  // Rendered to match FastAPI's RequestValidationError handler, which reports
  // only the first issue and prefixes the message with its location.
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const location = first ? first.path.join(".") : "";
    const message = first?.message ?? "Invalid request payload";
    res.status(422).json({
      success: false,
      data: null,
      message: `Validation error at ${location}: ${message}`,
      error: { code: "VALIDATION_ERROR", message, field: location },
    });
    return;
  }

  // ── Duplicate key on a unique index ──────────────────────────────────────
  // Reached when two requests race past an application-level existence check.
  if (
    err instanceof mongoose.mongo.MongoServerError &&
    err.code === 11000
  ) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? null;
    res
      .status(409)
      .json(
        failure(
          "DUPLICATE_KEY",
          "A record with this value already exists.",
          field,
        ),
      );
    return;
  }

  // ── Malformed ObjectId that escaped `toObjectId` ─────────────────────────
  if (err instanceof mongoose.Error.CastError) {
    res
      .status(404)
      .json(failure("NOT_FOUND", "Resource not found", err.path));
    return;
  }

  // ── Anything else is a genuine bug ───────────────────────────────────────
  logger.error({ err }, "Unhandled error");
  res
    .status(500)
    .json(
      failure(
        "INTERNAL_SERVER_ERROR",
        "Something went wrong on our end. Please try again.",
      ),
    );
}
