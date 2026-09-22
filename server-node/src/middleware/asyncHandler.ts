/**
 * Wrap an async route handler so a rejected promise reaches Express's error
 * handler instead of becoming an unhandled rejection.
 *
 * Express 4 does not await handlers. Every async controller is wrapped in this.
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}
