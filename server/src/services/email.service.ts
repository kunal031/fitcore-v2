/**
 * Transactional email, via Brevo's HTTP API.
 *
 * The API is used rather than SMTP because it needs no extra dependency and no
 * outbound SMTP port — several hosts, Render among them, block those on the
 * lower plans, which would leave mail silently undelivered in production while
 * working fine locally.
 */
import { settings } from "../config/env.js";
import { logger } from "../utils/logger.js";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/** How long to wait on Brevo before giving up, so a reset cannot hang a request. */
const SEND_TIMEOUT_MS = 10_000;

export interface SendEmailInput {
  to: string;
  toName?: string | undefined;
  subject: string;
  html: string;
  /** Shown by clients that refuse HTML, and better for deliverability. */
  text: string;
}

export const emailService = {
  /**
   * Send one transactional email.
   *
   * Returns whether it was accepted rather than throwing, because every caller
   * so far has to carry on either way: the password-reset flow must answer the
   * same to a caller whether or not delivery worked, so that it cannot be used
   * to discover which addresses are registered.
   */
  async send(input: SendEmailInput): Promise<boolean> {
    if (!settings.isEmailConfigured) {
      // Loud, because a missing key means no user can reset their password,
      // and the endpoint itself stays deliberately quiet about it.
      logger.error(
        "BREVO_API_KEY is not set — transactional email is disabled and no message was sent.",
      );
      return false;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

    try {
      const response = await fetch(BREVO_ENDPOINT, {
        method: "POST",
        headers: {
          "api-key": settings.BREVO_API_KEY,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: {
            email: settings.BREVO_SENDER_EMAIL,
            name: settings.BREVO_SENDER_NAME,
          },
          to: [{ email: input.to, ...(input.toName ? { name: input.toName } : {}) }],
          subject: input.subject,
          htmlContent: input.html,
          textContent: input.text,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Brevo explains refusals in the body — an unverified sender, an
        // exhausted quota — and none of that is guessable from the status.
        const detail = await response.text().catch(() => "");
        logger.error(
          { status: response.status, detail: detail.slice(0, 500) },
          "Brevo rejected the email.",
        );
        return false;
      }

      return true;
    } catch (error) {
      // A timeout arrives here as an AbortError, same as a network failure.
      logger.error({ err: error }, "Sending email through Brevo failed.");
      return false;
    } finally {
      clearTimeout(timeout);
    }
  },
};
