# Known Issues — carried over from the FastAPI server

This port reproduces the Python server's behaviour exactly, including the
problems below. Nothing here is a regression introduced by the migration; each
item exists in `server/` today and was preserved so the frontend keeps working
unchanged.

They are recorded here so the decision to fix them is deliberate rather than
accidental.

---

## 1. `verify-otp` reports failure with HTTP 200

**Where:** `POST /api/v1/auth/verify-otp` — `controllers/auth.controller.ts`

A wrong, expired or missing OTP answers `200 OK` with `data: null` and the
reason in `message`, instead of a 4xx with an `error` object. It is the only
endpoint in the API that signals failure this way.

**Impact:** a client that checks the status code rather than inspecting `data`
will treat a rejected OTP as a success.

**Fixing it** means returning 401/422 with a proper error code, and updating
any caller that currently reads `data === null`. No frontend code calls this
endpoint yet, so the blast radius is small today.

---

## 2. Password reset does not verify that an OTP was consumed

**Where:** `services/auth.service.ts` → `resetPassword`

`reset-password` validates the reset token and checks that its subject matches
the submitted phone number, but never confirms that a `PasswordResetOtp`
record for that phone was actually consumed. The token alone is the
credential.

**Impact:** low in practice — the token is only issued after a successful OTP
verification, is signed, and expires in 10 minutes. But it means a leaked
token is sufficient on its own, and a token remains usable even if the OTP
record is later invalidated.

**Fixing it** means recording the consumed OTP's id in the token and checking
it at reset time.

---

## 3. `GET /users/:userId/qr` does not check that the user exists

**Where:** `controllers/user.controller.ts` → `getMemberQr`

The handler enforces that a member may only request their own QR, then returns
`fitcore:member:<id>` without ever loading the user. Any well-formed ObjectId
produces a QR payload, including one belonging to nobody.

**Impact:** a staff member can generate a QR string for a non-existent member.
It carries no privileges — check-in independently resolves the member and
fails on an unknown id — so this is a correctness wart rather than a hole.

**Fixing it** is a one-line existence check before building the response.

---

## 4. A paused subscription keeps burning calendar days

**Where:** `services/subscription.service.ts` → `pause`

Pausing sets `status: "paused"` but does not stop or extend `expires_on`. A
plan paused for two weeks loses those two weeks: the member cannot attend, and
the window closes on the original date regardless.

**Impact:** members lose paid time whenever staff pause a plan, which is
usually exactly when they should not — injury, travel, a medical break.

**Fixing it** means recording the pause timestamp and pushing `expires_on`
forward by the paused duration on resume.

---

## 5. The owner dashboard can report a "popular plan" nobody has bought

**Where:** `services/dashboard.service.ts` → `getOwnerDashboard`

The most-subscribed plan is chosen with `count > maxActive` starting from
`-1`, over every plan including archived ones. On a fresh database every plan
has zero subscribers, so the first plan examined wins and is reported as
"popular" with `active_count: 0`.

**Impact:** cosmetic, and only visible before the first sale.

**Fixing it** means returning `null` when the winning count is zero.

---

## 6. Stale referral records are repaired on read

**Where:** `services/referral.service.ts` → `getMyReferral`

When a member has no referral document, the service looks for one matching
their referral *code* and adopts it by writing their user id onto it. This
exists to repair old seed data where the two were not linked.

**Impact:** a read path performs a write. It is also a latent footgun: if two
users ever ended up sharing a referral code, the second reader would silently
take ownership of the first's record.

**Fixing it** means migrating the affected records once and removing the
repair branch.

---

## 7. Deactivating a user does not revoke their tokens

**Where:** `services/user.service.ts` → `updateStatus`

Setting `is_active: false` blocks the account at the auth middleware, which
checks the flag on every request — so access does stop. But the user's
`token_version` is not incremented, unlike at logout.

**Impact:** none while the middleware check stands; it becomes a live hole the
moment user lookups are cached, which the caching strategy document proposes
doing with a 5-minute TTL.

**Fixing it** means bumping `token_version` alongside the flag. Worth doing
*before* introducing the auth cache.

---

## 8. Attendance and payment writes are not transactional

**Where:** `services/payment.service.ts` → `verifyPayment`,
`services/checkin.service.ts` → `markAttendance`

Verification marks the payment successful, creates the subscription,
increments the coupon and issues the referral reward as four separate writes.
A crash between them leaves the database partially updated — most seriously, a
payment marked successful with no subscription created.

Check-in has a narrower version: two concurrent requests for the same member
can both read `days_remaining` before either writes, so one attendance day is
charged instead of two.

**Impact:** rare, but the payment case costs a member their plan and requires
manual repair.

**Fixing it** means wrapping the writes in a MongoDB transaction, which
requires a replica set (Atlas provides one; a standalone local `mongod` does
not). The check-in race is separately fixable with a single atomic
`findOneAndUpdate` guarded on `days_remaining > 0`.

---

## 9. OTP and SMS delivery are mocked

**Where:** `services/otp.service.ts`, `jobs/expiryAlerts.job.ts`

Password-reset codes are written to the application log rather than sent by
SMS, and renewal alerts only log. This is intentional for development and is
documented in the project handoff.

**Impact:** **every password reset code is readable by anyone with log
access.** This must be replaced before any production deployment.

---

## Deliberate behaviour that is *not* a bug

For the avoidance of doubt, these look surprising but are correct and are
relied upon by the frontend:

- **Coupon validation returns HTTP 200 with `valid: false`.** An unusable
  coupon is a normal answer, not an error; the `reason` is shown inline at
  checkout.
- **`GET /subscriptions/me` returns 200 with `success: false` and null data**
  when the member has no plan. "No subscription" is a state, not a failure.
- **Same-day re-entry does not deduct a day.** The quota is charged per day
  attended, not per scan.
- **The backend role is `owner`; the UI labels it "Admin".** Renaming the role
  value would break existing tokens and seeded accounts.
