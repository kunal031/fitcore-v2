/**
 * Password hashing.
 *
 * bcrypt, configured so that hashes created
 * by either server verify against the other. Existing seeded accounts keep
 * working after the migration.
 */
import bcrypt from "bcryptjs";

/** Cost factor. 12 is a common bcrypt default. */
const SALT_ROUNDS = 12;

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Constant-time comparison of a plain password against a stored hash.
 *
 * Returns false rather than throwing on a malformed hash, so a corrupt record
 * reads as a failed login instead of a 500.
 */
export async function verifyPassword(
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch {
    return false;
  }
}
