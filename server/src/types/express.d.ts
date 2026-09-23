/**
 * Augments Express's Request with the authenticated user.
 *
 * `requireAuth` populates `req.user`; every handler behind it can rely on the
 * field being present.
 */
import type { UserDoc } from "../models/User.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDoc;
    }
  }
}

export {};
