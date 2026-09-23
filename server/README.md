# FitCore — API

Gym membership backend: plans, subscriptions, attendance, payments, coupons
and referrals.

Node.js + Express + TypeScript + MongoDB (Mongoose).

## Requirements

- Node.js 18+
- MongoDB (local, or an Atlas connection string)

## Getting started

```bash
npm install
cp .env.example .env        # then fill in the values
npm run dev                 # http://localhost:8000
```

The API serves under the `/api/v1` prefix.
Health check: `http://localhost:8000/health`.

### Seed data

```bash
npm run seed     # base accounts, plans, coupons
npm run demo     # demo members, subscriptions, payments, attendance
```

Both are idempotent — re-running them never duplicates or overwrites data.
`npm run demo` requires `npm run seed` to have run first.

Development accounts (seeded, **development only**):

```text
Admin:   +919999999999 / Owner@123
Trainer: +918888888888 / Trainer@123
Member:  +917777777777 / Member@123
Demo:    +919100000001 … +919100000010 / Member@123
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server |
| `npm run typecheck` | Type-check without emitting |
| `npm run seed` | Seed base accounts, plans and coupons |
| `npm run demo` | Seed the demo dataset |

### Docker

```bash
docker compose up --build    # API on :8000, MongoDB on :27017
```

## Environment

`.env` is git-ignored and must never be committed.

| Key | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `DATABASE_NAME` | Database name |
| `JWT_SECRET_KEY` | Signs access, refresh and password-reset tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime (default 15) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime (default 30) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Leave as the placeholders to keep payments mocked |
| `PORT` | Listen port (default 8000) |

Startup validates the environment and fails immediately on a missing or
malformed value, rather than on the first request that needs it.

## Project layout

Each directory holds one kind of thing, and a request passes through them in
order:

```text
src/
├── config/         env validation, database connection, domain constants
├── models/         Mongoose schemas — one file per collection
├── dtos/           zod request schemas + response types, one per domain
├── repositories/   every database query, isolated per collection
├── services/       business logic, one file per domain
│   └── mappers/    document → response shape conversion
├── controllers/    thin HTTP handlers: status codes and messages only
├── routes/         route tables and ordering, one per domain
├── middleware/     auth, roles, validation, rate limiting, errors, logging
├── jobs/           scheduled jobs + the cron scheduler
├── errors/         AppError and the HTTP error subclasses
├── utils/          jwt, password, date, money, phone, ids, response envelope
├── scripts/        seed and demo-data scripts
│   └── fixtures/   demo dataset, separate from the code that writes it
├── app.ts          Express assembly (exported without listening, for tests)
└── server.ts       process entry: connect, schedule, listen, shut down
```

**A request flows** route → middleware (auth, role, validate) → controller →
service → repository → model. Layers only call downward: a controller never
touches a model, and a service never formats an HTTP response.

**Where to make a change:**

| To change… | Edit |
|---|---|
| a validation rule | `dtos/<domain>.dto.ts` |
| a business rule | `services/<domain>.service.ts` |
| a database query | `repositories/<domain>.repository.ts` |
| a response field | `services/mappers/<domain>.mapper.ts` |
| who may call a route | `routes/<domain>.routes.ts` |
| a stored field | `models/<Model>.ts` |

## API

51 routes across nine groups, all under `/api/v1`. Full request and response
documentation is in [`../docs/backend_routes_encyclopedia.md`](../docs/backend_routes_encyclopedia.md).

| Group | Prefix | Routes |
|---|---|---|
| Auth | `/auth` | 8 |
| Users | `/users` | 9 |
| Plans | `/plans` | 7 |
| Subscriptions | `/subscriptions` | 7 |
| Check-in | `/checkin` | 3 |
| Payments | `/payments` | 5 |
| Coupons | `/coupons` | 6 |
| Referrals | `/referrals` | 2 |
| Dashboard | `/dashboard` | 2 |

Plus `GET /` and `GET /health`, which sit outside the versioned prefix.

### Response envelope

Every endpoint returns the same shape:

```json
{ "success": true, "data": { }, "message": "…", "error": null }
```

and on failure:

```json
{
  "success": false,
  "data": null,
  "message": "…",
  "error": { "code": "PHONE_ALREADY_EXISTS", "message": "…", "field": null }
}
```

Paginated endpoints nest `data: { items: [], meta: { page, limit, total, pages } }`.

Clients should branch on `error.code`, which is stable, rather than on message
text.

Two endpoints answer 200 for what looks like a failure, by design:
`GET /coupons/validate/:code` returns `valid: false` with a `reason`, and
`GET /subscriptions/me` returns `success: false` with null data when the
member has no plan.

## Domain notes

**Money is always integer paise.** 150000 = ₹1,500.00. No float ever holds a
monetary amount; only `paiseToInr` converts, and only for display.

**Subscriptions are bounded on two independent axes.** `calendar_days` sets
the expiry window; `allocated_days` sets the visit quota. Whichever runs out
first ends the plan — the window closing makes it `expired`, the quota
emptying makes it `exhausted`. `days_remaining` (visits) and
`days_until_expiry` (calendar days) are different numbers.

**Attendance is charged per day, not per scan.** The first check-in of a
calendar day spends one day; re-entry the same day is free. Only a trainer or
the owner can record attendance.

**Plans are snapshotted at purchase.** Editing or archiving a plan never
changes what an existing member bought.

**Discounts stack coupon-first, then referral,** with the referral capped by
what remains, so the two together can never exceed the plan price. Referral
discounts apply to a member's first purchase only.

**Sessions are invalidated by version, not a denylist.** Every token carries
`ver`; logout increments the user's `token_version`, retiring every token
issued before it.

## Stored date formats

Calendar dates (`starts_on`, `expires_on`, `profile.dob`, `gym_meta.joined_on`)
are written as `YYYY-MM-DD` strings. Records created under an earlier schema
hold BSON dates in these fields instead.

MongoDB compares across BSON types by type order, so a query bound to one form
silently skips the other. Reads go through `toCalendarDateStr()` in
`utils/date.ts`; any query that filters on these fields must match both forms
explicitly. Normalising them in a one-off migration would remove this class of
bug for good.

## Known issues

Known defects, with their impact and fix sketches, are catalogued in
[`KNOWN_ISSUES.md`](KNOWN_ISSUES.md). Read it before changing payment, OTP or
subscription code.

The two that matter most:

- **OTP codes are written to the log, not sent by SMS.** Anyone with log
  access can read any password reset code. Must be replaced before production.
- **Payment verification is not transactional.** A crash mid-verification can
  leave a payment marked successful with no subscription created.
