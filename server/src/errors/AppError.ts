/**
 * Base application error.
 *
 * Mirrors `FitCoreException` in `server/app/core/exceptions.py`. Every error
 * thrown by a service carries the HTTP status, a stable machine-readable
 * `errorCode` the frontend switches on, and an optional offending `field`.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly field?: string | undefined;

  constructor(
    statusCode: number,
    errorCode: string,
    message: string,
    field?: string,
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.field = field;
    Error.captureStackTrace?.(this, new.target);
  }
}
