/**
 * Application logger.
 *
 * Pretty, human-readable lines in development; structured JSON in production
 * so a log aggregator can parse them.
 */
import pino from "pino";

import { settings } from "../config/env.js";

export const logger = pino({
  level: settings.LOG_LEVEL.toLowerCase(),
  ...(settings.isProduction
    ? {}
    : {
        transport: {
          target: "pino/file",
          options: { destination: 1 },
        },
      }),
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});
