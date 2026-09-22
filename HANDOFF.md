# FitCore v2 — Handoff

Gym membership portal: plans, subscriptions, attendance, payments, coupons and
referrals. Read this before changing anything.

**State:** the FastAPI backend has been ported to Node/Express/TypeScript. The
Node server is the live one. Both frontend and backend are deployed.

---

## Layout

```text
client/        React + TypeScript + Vite   → Vercel
server-node/   Node + Express + TypeScript → Render   ← the live backend
server/        FastAPI + Beanie            → reference only, not deployed
docs/          route encyclopedia, API tree, caching notes
```

`server/` is kept for reference while parity is confirmed. It is not running
and should not be edited. Delete it once you are satisfied the port is
complete.

---

## Running locally

```bash
cd server-node && npm install && cp .env.example .env   # fill in the values
npm run dev                                             # :8000

cd client && npm install
npm run dev                                             # :5173
```

The Vite dev server proxies `/api` to `localhost:8000`, so the client needs no
environment variable in development.

Seed data (idempotent; `demo` requires `seed` to have run):

```bash
cd server-node
npm run seed    # admin, trainer, member, starter plans, two coupons
npm run demo    # 10 demo members with subscriptions, payments, attendance
```

Development accounts:

```text
Admin:   +919999999999 / Owner@123
Trainer: +918888888888 / Trainer@123
Member:  +917777777777 / Member@123
Demo:    +919100000001 … +919100000010 / Member@123
```

Login accepts a phone number **or** an email address in the same field.

---

## Backend

52 routes under `/api/v1`, across nine groups. Full request and response
documentation is in `docs/backend_routes_encyclopedia.md` — accurate for the
original 51; the two added since are noted below.

| Group | Prefix | Routes |
|---|---|---|
| Auth | `/auth` | 8 |
| Users | `/users` | 9 |
| Plans | `/plans` | 7 |
| Subscriptions | `/subscriptions` | 8 |
| Check-in | `/checkin` | 3 |
| Payments | `/payments` | 5 |
| Coupons | `/coupons` | 6 |
| Referrals | `/referrals` | 2 |
| Dashboard | `/dashboard` | 4 |

Added beyond the original port:

- `GET /dashboard/analytics` — membership and plan analytics (owner)
- `GET /dashboard/analytics/members/:cohort` — the members behind one figure
- `GET /subscriptions/member/:memberId` — a member's current plan, for staff

### Directory layout

A request flows **route → middleware → controller → service → repository →
model**. Layers only call downward: a controller never touches a model, a
service never formats an HTTP response.

```text
src/
├── config/         env validation, database connection, constants
├── models/         7 Mongoose schemas
├── dtos/           zod request schemas + response types
├── repositories/   every database query, isolated per collection
├── services/       business logic (+ mappers/ for response shaping)
├── controllers/    thin HTTP handlers: status codes and messages only
├── routes/         route tables and ordering
├── middleware/     auth, roles, validate, rateLimit, errors, logging
├── jobs/           3 cron jobs + scheduler
├── errors/         AppError hierarchy
├── utils/          jwt, password, date, money, phone, ids, envelope
└── scripts/        seed + demoData
```

**To change X, edit Y:** a validation rule → `dtos/`; a business rule →
`services/`; a query → `repositories/`; a response field →
`services/mappers/`; who may call a route → `routes/`; a stored field →
`models/`.

### Response envelope

Every endpoint returns the same shape:

```json
{ "success": true, "data": {}, "message": "…", "error": null }
```

On failure `error` carries `{ code, message, field }`. **Branch on
`error.code`**, which is stable — never on message text.

Two endpoints answer 200 for what looks like failure, by design:
`GET /coupons/validate/:code` returns `valid: false` with a `reason`, and
`GET /subscriptions/me` returns `success: false` with null data when the member
has no plan.

---

## Domain rules

These are the ones that bite if you do not know them.

**Money is integer paise.** 150000 = ₹1,500.00. No float ever holds a monetary
amount; only `paiseToInr` converts, for display.

**Subscriptions are bounded on two independent axes.** `calendar_days` is the
expiry window; `allocated_days` is the visit quota. Whichever runs out first
ends the plan — the window closing makes it `expired`, the quota emptying makes
it `exhausted`. `days_remaining` (visits) and `days_until_expiry` (calendar
days) are different numbers.

**No plan means no gym access.** Check-in refuses a member without an active
subscription, with an expired one, or with an exhausted quota. This is enforced
in `checkin.service.ts`, which queries subscriptions directly.

**Attendance is charged per day, not per scan.** The first check-in of a
calendar day spends one day; re-entry the same day is free. Only a trainer or
owner records attendance — members never check themselves in.

**Staff have no plan**, so they cannot be marked present. The backend refuses
with `NO_ACTIVE_SUBSCRIPTION`. The UI shows their role instead of a button that
would always fail.

**Plans are snapshotted at purchase.** Editing or archiving a plan never
changes what an existing member bought. Plans and coupons are **never deleted**,
only deactivated — a product decision, and deleting would orphan the
subscriptions and receipts referencing them.

**Discounts stack coupon-first, then referral**, with the referral capped by
what remains, so the two together can never exceed the plan price. Referral
discounts apply to a first purchase only.

**Sessions are invalidated by version.** Every token carries `ver`; logout
increments the user's `token_version`, retiring every token issued before it.

**The backend role is `owner`; the UI labels it "Admin".** Renaming the role
value would break existing tokens and seeded accounts.

---

## Frontend

Tabs are URL-backed via `hooks/useTabRoute.ts`, so every view has its own
address and the browser back button works.

```text
Member:  /app/home  /app/plans  /app/referrals  /app/profile
         (+ /app/checkout, /app/attendance, /app/payments — reached in-app)
Staff:   /app/analytics  /app/members  /app/attendance  /app/plans  /app/coupons
```

Admins land on `/app/analytics`; trainers on `/app/members`. The logo returns
to that landing tab.

**`DashboardPage` branches by role before any hook runs.** Rendering
`StaffWorkspace` from inside the member component meant both called
`useTabRoute` on the same URL and fought over it — React runs hooks before an
early return. Keep that branch first.

**Navigation is one `<nav class="app-nav">` with two shapes** — a fixed bottom
bar below 900px, a full-height sidebar above. One element, so the active tab
cannot desync.

**Auth pages keep their own light palette**, scoped under `.auth-layout`. An
earlier unscoped copy of those rules was overriding `.eyebrow`, `.muted` and
`.brand-mark` across the whole app.

Sessions: a 401 refreshes the token once and replays the request, signing out
only if the refresh itself fails. Concurrent 401s share one refresh.

---

## Deployment

**Backend → Render** (`server-node/render.yaml`)

Docker runtime, with **Docker Build Context Directory** `server-node` and
**Dockerfile Path** `server-node/Dockerfile`. The Node runtime works too and
builds faster.

Required environment: `MONGODB_URI`, `DATABASE_NAME`, `JWT_SECRET_KEY`,
`CORS_ORIGINS`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `ENVIRONMENT`.
Do **not** set `PORT` — Render injects it.

**Frontend → Vercel** (`client/vercel.json`)

`VITE_API_BASE_URL` is required at **build time** and baked into the bundle —
the build fails without it rather than shipping a site that cannot reach its
backend. Include the `/api/v1` suffix.

`vercel.json` rewrites every path to `index.html`; without it, any deep link or
refresh returns Vercel's 404.

`CORS_ORIGINS` on the backend must list the frontend's exact origin — scheme
and host, no trailing slash.

---

## Known issues

`server-node/KNOWN_ISSUES.md` catalogues defects carried over verbatim from the
FastAPI server, with impact and fix sketches. Read it before touching payment,
OTP or subscription code. The two that matter most:

- **OTP codes are written to the application log, not sent by SMS.** Anyone
  with log access can read any password reset code. Must be replaced before
  real use.
- **Payment verification is not transactional.** A crash mid-flow can leave a
  payment marked successful with no subscription created.

### Mixed date formats — the recurring trap

`joined_on`, `dob`, `starts_on` and `expires_on` are stored **two ways**:
records written by the Python server hold BSON dates, those written by the Node
server hold `YYYY-MM-DD` strings.

MongoDB compares across BSON types by type order, so a query bound to one form
**silently skips** the other. This has already caused three separate bugs
(subscription expiry, user join dates, the joined-this-month count). Reads go
through `toCalendarDateStr()`; queries that filter on these fields must match
both forms explicitly.

A one-off migration normalising them would remove this class of bug for good,
and is the single highest-value cleanup available.

---

## Housekeeping

Left in the Atlas database during development:

- **"Rule Test User"** (`+919555000111`) — created while verifying the no-plan
  rule, since deactivated. Safe to delete.
- **"ZZ Verify Plan"** — an archived plan not in any seed script.
- **Demo Member 10** has an exhausted 312-visit quota from repeated attendance
  testing; they need a new plan to be usable.

---

## Conventions

- Match the surrounding code's comment density and idiom.
- Explain **why**, not what. A comment that restates the line is noise.
- Verify by doing, not by reading: call the endpoint, click the button, measure
  the result. Several bugs in this project looked correct in the source.
- Commit in logical units with messages that explain the reasoning.
