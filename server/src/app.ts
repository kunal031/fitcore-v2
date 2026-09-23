/**
 * Express application assembly.
 *
 * Mirrors `server/app/main.py`. Exported without starting a listener so tests
 * can mount it directly.
 *
 * Middleware order is deliberate: logging first so every request is recorded,
 * then security headers and CORS, then body parsing, then the rate limiter,
 * then routes, and finally the 404 and error handlers.
 */
import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";

import { checkDbHealth } from "./config/database.js";
import { settings } from "./config/env.js";
import {
  errorHandler,
  globalLimiter,
  notFoundHandler,
  requestLogger,
} from "./middleware/index.js";
import { apiV1Router } from "./routes/index.js";

export function createApp(): Express {
  const app = express();

  // Behind a proxy (Docker, nginx, a PaaS) the client IP arrives in
  // X-Forwarded-For; without this the rate limiter would key every request to
  // the proxy's address.
  app.set("trust proxy", 1);

  app.use(requestLogger);
  app.use(helmet());
  app.use(
    cors({
      origin: settings.corsOriginsList,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(globalLimiter);

  // ── Service metadata ─────────────────────────────────────────────────────
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      name: "FitCore Gym Management API",
      version: "2.0.0",
      docs: "/docs",
      status: "online",
    });
  });

  /**
   * Liveness and dependency check.
   *
   * Reports `degraded` rather than failing when MongoDB is unreachable, so an
   * orchestrator can tell "the process is up but its database is not" from
   * "the process is down".
   */
  app.get("/health", async (_req: Request, res: Response) => {
    const dbOk = await checkDbHealth();
    res.json({
      success: true,
      status: dbOk ? "healthy" : "degraded",
      database: dbOk ? "connected" : "disconnected",
      version: "2.0.0",
    });
  });

  // ── API ──────────────────────────────────────────────────────────────────
  app.use("/api/v1", apiV1Router);

  // ── Terminal handlers ────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
