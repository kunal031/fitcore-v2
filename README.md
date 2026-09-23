# FitCore

Gym and fitness membership portal: plan sales, subscriptions, attendance tracking, payments, coupons and referrals.

- `server/` — Node.js + Express + TypeScript, MongoDB via Mongoose
- `client/` — React + TypeScript + Vite
- `docs/` — route reference, frontend API map, caching notes

## Requirements

- Node.js 18+
- MongoDB (local, or an Atlas connection string)

## Backend

```bash
cd server
npm install
cp .env.example .env              # then fill in the values below
npm run dev
```

The API serves on `http://localhost:8000` under the `/api/v1` prefix. Health check: `http://localhost:8000/health`.

Useful scripts:

```bash
npm run build       # compile TypeScript to dist/
npm start           # run the compiled build
npm run typecheck   # type-check without emitting
npm run lint
```

### Environment

`.env` is git-ignored and must never be committed. Required keys:

| Key                                       | Purpose                                   |
| ----------------------------------------- | ----------------------------------------- |
| `MONGODB_URI`                             | MongoDB connection string                 |
| `DATABASE_NAME`                           | Database name                             |
| `JWT_SECRET_KEY`                          | Signing key for access and refresh tokens |
| `CORS_ORIGINS`                            | Comma-separated allowed origins           |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Unused while payments are mocked          |
| `ENVIRONMENT`                             | `development` or `production`             |

### Seed data

Both scripts are idempotent; `demo` requires `seed` to have run first.

```bash
npm run seed    # base accounts, plans, coupons, referrals
npm run demo    # demo members with subscriptions, payments, attendance
```

Development accounts (seeded, development only):

```text
Admin:   +919999999999 / Owner@123
Trainer: +918888888888 / Trainer@123
Member:  +917777777777 / Member@123
Demo:    +919100000001 … +919100000010 / Member@123
```

Sign-in accepts a phone number or an email address in the same field.

## Frontend

```bash
cd client
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check and production build
```

In development, Vite proxies `/api` to the backend, so the browser makes same-origin requests and no CORS setup is needed.

For a production build, `VITE_API_BASE_URL` is required at build time and is baked into the bundle — include the `/api/v1` suffix.

## Docker

`server/docker-compose.yml` runs the API and a MongoDB instance together, so local development needs no MongoDB install and no Atlas connection.

```bash
cd server
cp .env.example .env      # MONGODB_URI is overridden by compose
docker compose up --build
```

The API is on `http://localhost:8000` and MongoDB on `localhost:27017`, with data kept in a named volume across restarts. Compose waits for the database health check before starting the API.

`server/Dockerfile` builds the API image on its own, in two stages: TypeScript is compiled with the dev dependencies present, and only the compiled output is copied into the runtime image, which runs as an unprivileged user.

```bash
cd server
docker build -t fitcore-api .
```

`.dockerignore` keeps `node_modules`, build output and `.env` out of the image — the local `node_modules` is built for the host platform, and `.env` holds secrets that must never be baked into an image layer.

## Roles

The backend stores three role values: `owner`, `trainer` and `member`. The `owner` role is displayed as **Admin** throughout the UI — the stored value is never renamed.

| Capability                       | Admin | Trainer | Member |
| -------------------------------- | ----- | ------- | ------ |
| Manage plans and coupons         | ✓     |         |        |
| View members and mark attendance | ✓     | ✓       |        |
| View revenue and analytics       | ✓     |         |        |
| Browse plans, buy, use coupons   |       |         | ✓      |
| View own payments and referrals  |       |         | ✓      |

Members do not record their own attendance; a trainer or admin marks it. The first check-in of a day deducts one day from the member's quota, and a repeat check-in the same day is treated as re-entry without deducting again.

A subscription is bounded on two independent axes: a calendar window (`calendar_days`) and a visit quota (`allocated_days`). Whichever runs out first ends the plan.

## API

52 routes under `/api/v1` across nine groups: auth, users, plans, subscriptions, check-in, payments, coupons, referrals and dashboard.

Every endpoint returns the same envelope:

```json
{ "success": true, "data": {}, "message": "…", "error": null }
```

On failure, `error` carries `{ code, message, field }`. Clients branch on `error.code`, which is stable, never on message text.

Full request and response documentation is in `docs/backend_routes_encyclopedia.md`.

## Deployment

**Backend → Render**, using `server/render.yaml`. Set the environment keys listed above. Do not set `PORT` — the platform injects it.

**Frontend → Vercel**, using `client/vercel.json`, which rewrites every path to `index.html` so deep links and refreshes resolve. `CORS_ORIGINS` on the backend must list the frontend's exact origin — scheme and host, with no trailing slash.

Defects and their fix sketches are catalogued in `server/KNOWN_ISSUES.md`. Read it before changing payment, OTP or subscription code.
