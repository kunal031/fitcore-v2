/**
 * Process entry point.
 *
 * Connects to MongoDB and starts the scheduler before accepting traffic, so a
 * request can never arrive before its dependencies are ready, and shuts both
 * down cleanly on a termination signal.
 */
import { closeDatabaseConnection, connectToDatabase } from "./config/database.js";
import { settings } from "./config/env.js";
import { startScheduler, stopScheduler } from "./jobs/index.js";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("Initializing FitCore v2 server...");

  await connectToDatabase();
  startScheduler();

  const app = createApp();
  // Bind 0.0.0.0 explicitly: a platform health check reaches the container
  // from outside, and binding only localhost would make the service
  // unreachable and the deploy fail with no obvious error.
  const server = app.listen(settings.PORT, "0.0.0.0", () => {
    logger.info(
      `FitCore v2 server is ready on port ${settings.PORT} (${settings.ENVIRONMENT}).`,
    );
  });

  /**
   * Graceful shutdown: stop accepting connections, let in-flight requests
   * finish, then release the scheduler and the database pool.
   */
  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}. Shutting down FitCore v2 server...`);

    server.close(() => {
      stopScheduler();
      void closeDatabaseConnection().finally(() => {
        logger.info("FitCore v2 server shutdown complete.");
        process.exit(0);
      });
    });

    // Do not hang forever on a stuck connection.
    setTimeout(() => {
      logger.error("Shutdown timed out. Forcing exit.");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "Failed to start server");
  process.exit(1);
});
