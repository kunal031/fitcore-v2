/**
 * The password-reset email.
 *
 * Deliberately plain: inline styles only, a table for the code, no external
 * images or fonts. Mail clients strip <style> blocks and block remote assets,
 * so anything richer degrades to unreadable in the clients that matter.
 */
import { OTP_EXPIRY_MINUTES } from "../../config/constants.js";

export interface PasswordResetEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildPasswordResetEmail(
  fullName: string,
  otp: string,
): PasswordResetEmail {
  const greeting = fullName.trim() ? `Hi ${fullName.trim()},` : "Hi,";

  return {
    subject: `${otp} is your FitCore password reset code`,
    text: [
      greeting,
      "",
      `Your FitCore password reset code is ${otp}.`,
      `It expires in ${OTP_EXPIRY_MINUTES} minutes and can be used once.`,
      "",
      "If you did not ask to reset your password, you can ignore this email — nothing has changed.",
      "",
      "— FitCore",
    ].join("\n"),
    html: `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f3f6f2;font-family:Arial,Helvetica,sans-serif;color:#17211f;">
    <div style="max-width:480px;margin:0 auto;padding:28px;background:#ffffff;border-radius:16px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:bold;letter-spacing:.12em;text-transform:uppercase;color:#78ad00;">FitCore</p>
      <h1 style="margin:0 0 18px;font-size:21px;">Reset your password</h1>

      <p style="margin:0 0 14px;font-size:15px;line-height:1.5;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">
        Use this code to set a new password.
      </p>

      <div style="margin:0 0 20px;padding:18px;border-radius:12px;background:#f3f6f2;text-align:center;">
        <span style="font-size:30px;font-weight:bold;letter-spacing:.24em;color:#17211f;">${escapeHtml(otp)}</span>
      </div>

      <p style="margin:0 0 14px;font-size:14px;line-height:1.5;color:#60706c;">
        The code expires in ${OTP_EXPIRY_MINUTES} minutes and works once.
      </p>
      <p style="margin:0;font-size:14px;line-height:1.5;color:#60706c;">
        If you did not ask for this, ignore this email — your password has not changed.
      </p>
    </div>
  </body>
</html>`,
  };
}

/** The name comes from user input, so it cannot go into the markup unescaped. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
