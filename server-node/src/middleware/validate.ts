/**
 * Request validation.
 *
 * Parses body, query and params against zod schemas and writes the parsed
 * result back onto the request, so handlers receive coerced, defaulted values
 * rather than raw strings. Failures surface as a ZodError, which the global
 * error handler renders as a 422 in FastAPI's format.
 */
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodTypeAny } from "zod";

export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      if (schemas.query) {
        // Express 5 makes req.query a getter; assign the parsed copy to a
        // separate property that handlers read instead.
        Object.defineProperty(req, "query", {
          value: schemas.query.parse(req.query),
          writable: true,
          configurable: true,
        });
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body) as typeof req.body;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
