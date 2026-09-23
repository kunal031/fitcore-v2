/**
 * MongoDB connection lifecycle.
 *
 * Mirrors `server/app/core/database.py`. Importing the model barrel registers
 * every schema before `connect` runs, so index creation happens once at
 * startup rather than lazily on first use.
 */
import mongoose from "mongoose";

import { settings } from "./env.js";
import { logger } from "../utils/logger.js";
import "../models/index.js";

/** Open the connection pool and build indexes. Throws if the server is unreachable. */
export async function connectToDatabase(uri?: string, dbName?: string): Promise<void> {
  const target = uri ?? settings.MONGODB_URI;
  const database = dbName ?? settings.DATABASE_NAME;

  // Log the host only — never the credentials that may precede the "@".
  logger.info(`Connecting to MongoDB at ${target.split("@").pop()}...`);

  try {
    await mongoose.connect(target, {
      dbName: database,
      serverSelectionTimeoutMS: 8000,
    });
    logger.info("MongoDB connected and models registered successfully.");
  } catch (error) {
    logger.error({ err: error }, "Failed to initialize database");
    throw error;
  }
}

/** Close the connection pool during shutdown. */
export async function closeDatabaseConnection(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  logger.info("Closing MongoDB connection...");
  await mongoose.connection.close();
  logger.info("MongoDB connection closed.");
}

/** Ping the server. Backs the `degraded` state reported by `GET /health`. */
export async function checkDbHealth(): Promise<boolean> {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      return false;
    }
    await mongoose.connection.db.admin().command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
