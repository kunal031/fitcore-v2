/**
 * ObjectId parsing.
 *
 * Route parameters arrive as strings. Casting an invalid one with Mongoose
 * throws a CastError deep inside a query; parsing up front turns that into the
 * 404 returned for an unknown id.
 */
import { Types } from "mongoose";

import { NotFoundError } from "../errors/index.js";

/** True when the string is a well-formed 24-character ObjectId. */
export function isValidObjectId(value: string): boolean {
  return Types.ObjectId.isValid(value) && String(new Types.ObjectId(value)) === value;
}

/**
 * Parse an id, throwing `NotFoundError` with the caller's message when it is
 * malformed — the same outcome as looking up an id that does not exist.
 */
export function toObjectId(
  value: string,
  message = "Resource not found",
  errorCode = "NOT_FOUND",
): Types.ObjectId {
  if (!isValidObjectId(value)) {
    throw new NotFoundError(message, errorCode);
  }
  return new Types.ObjectId(value);
}

/** Compare two ids that may be ObjectId or string. */
export function idEquals(
  a: Types.ObjectId | string | null | undefined,
  b: Types.ObjectId | string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return String(a) === String(b);
}
