/**
 * The single response envelope every endpoint returns.
 *
 * Mirrors `APIResponse` / `PaginatedResponse` in `server/app/schemas/common.py`.
 * The frontend reads `response.data.data` everywhere, so the `data` key must be
 * present on success responses even when its value is null.
 */

export interface ApiErrorDetails {
  code: string;
  message: string;
  field: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  error: ApiErrorDetails | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginationMeta;
}

export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

/** Build a success envelope. */
export function success<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message: message ?? null,
    error: null,
  };
}

/**
 * Build a success-shaped envelope with `success: false` but no error object.
 *
 * `GET /subscriptions/me` uses this when the member has no active plan: the
 * Python route returns `success=False, data=None` with HTTP 200 rather than a
 * 404, and the frontend relies on that.
 */
export function emptyResult(message: string): ApiResponse<null> {
  return {
    success: false,
    data: null,
    message,
    error: null,
  };
}

/** Build a failure envelope. Used by the global error handler. */
export function failure(
  code: string,
  message: string,
  field?: string | null,
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    message,
    error: { code, message, field: field ?? null },
  };
}

/** Wrap a page of results in the paginated envelope. */
export function paginated<T>(
  items: T[],
  meta: PaginationMeta,
  message?: string,
): PaginatedResponse<T> {
  return {
    success: true,
    data: { items, meta },
    message: message ?? null,
    error: null,
  };
}

/** Compute `meta` from the raw counts, matching the Python ceiling division. */
export function buildMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const pages = limit > 0 ? Math.floor((total + limit - 1) / limit) : 1;
  return { page, limit, total, pages };
}
