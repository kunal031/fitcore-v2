/**
 * Check that transactional email is actually deliverable.
 *
 * The reset endpoint deliberately answers the same whether or not the mail
 * went out — it must not reveal which addresses are registered — so a failure
 * is only visible in the log. This reports it directly instead, and names the
 * two things that block a new Brevo account: an unauthorised IP and an
 * unverified sender.
 *
 *   npm run check-email                  # configuration only
 *   npm run check-email -- you@mail.com  # also send a real test message
 */
import { settings } from "../config/env.js";
import { emailService } from "../services/email.service.js";
import { logger } from "../utils/logger.js";

/** Brevo reports the caller's public IP when it refuses one. */
async function reportOutboundIp(): Promise<void> {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const body = (await response.json()) as { ip?: string };
    if (body.ip) {
      logger.info(`This machine calls out from ${body.ip}.`);
      logger.info(
        "If Brevo refuses that address, allow it under Security -> Authorised IPs, or turn the allowlist off.",
      );
    }
  } catch {
    // Only a convenience; Brevo names the address in its refusal anyway.
  }
}

async function main(): Promise<void> {
  const recipient = process.argv[2];

  logger.info("--- Email configuration ---");
  logger.info(`  API key set:  ${settings.isEmailConfigured ? "yes" : "NO"}`);
  logger.info(`  Sender:       ${settings.BREVO_SENDER_NAME} <${settings.BREVO_SENDER_EMAIL}>`);

  if (!settings.isEmailConfigured) {
    logger.error("BREVO_API_KEY is empty — no reset code can be delivered.");
    process.exit(1);
  }

  // A placeholder sender passes every local check and is then refused by
  // Brevo, which is a confusing way to find out.
  if (settings.BREVO_SENDER_EMAIL.endsWith("@fitcore.app")) {
    logger.warn(
      "Sender is still the built-in placeholder. Brevo only sends from a verified sender — set BREVO_SENDER_EMAIL to yours.",
    );
  }

  await reportOutboundIp();

  if (!recipient) {
    logger.info("Pass an address to send a real test message, e.g. npm run check-email -- you@mail.com");
    return;
  }

  logger.info(`--- Sending a test message to ${recipient} ---`);
  const sent = await emailService.send({
    to: recipient,
    subject: "FitCore email check",
    text: "Transactional email is working. Password reset codes will reach this inbox.",
    html: "<p>Transactional email is working. Password reset codes will reach this inbox.</p>",
  });

  if (sent) {
    logger.info("Accepted by Brevo. Check the inbox, and the spam folder.");
  } else {
    logger.error("Brevo refused it — the reason is logged above.");
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "Email check failed.");
  process.exit(1);
});
