/**
 * Request logging.
 *
 * Mirrors `LoggingMiddleware`: one line per request with method, path, status,
 * duration and client IP.
 */
import pinoHttp from "pino-http";

import { logger } from "../utils/logger.js";

export const requestLogger = pinoHttp({
  logger,
  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage(req, res, responseTime) {
    return `${req.method} ${req.url} | Status: ${res.statusCode} | Time: ${Math.round(responseTime)}ms`;
  },
  customErrorMessage(req, res, err) {
    return `${req.method} ${req.url} | Exception: ${err.message} | Status: ${res.statusCode}`;
  },
  // The default serializers log full headers, including the bearer token.
  serializers: {
    req(req) {
      return { method: req.method, url: req.url, ip: req.remoteAddress };
    },
    res(res) {
      return { statusCode: res.statusCode };
    },
  },
});
