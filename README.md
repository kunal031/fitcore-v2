# FitCore v2

Gym and fitness membership portal: plan sales, subscriptions, attendance
tracking, coupons and referrals.

- **`server/`** — FastAPI + MongoDB (Beanie ODM)
- **`client/`** — React + TypeScript + Vite

> Version 1 (Streamlit/FastAPI) lives in a separate repository and is
> superseded by this one.

## Requirements

- Python 3.11+
- Node.js 18+
- MongoDB (local, or an Atlas connection string)

## Backend

```bash
cd server
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env              # then fill in the values below
uvicorn app.main:app --reload
```

The API serves on `http://localhost:8000` under the `/api/v1` prefix.
Health check: `http://localhost:8000/health`.
Interactive docs: `http://localhost:8000/docs`.

### Environment

`.env` is git-ignored and must never be committed. Required keys:

| Key | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `DATABASE_NAME` | Database name |
| `JWT_SECRET_KEY` | Signing key for access/refresh tokens |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Unused while payments are mocked |
| `TEST_MONGODB_URI` | Only needed to run integration tests |

### Seed data

```bash
source venv/bin/activate
python -m app.seed         # base accounts, plans, coupons, referrals
python -m app.demo_data    # demo members, subscriptions, payments, attendance
```

Development accounts (seeded, development only):

```text
Admin:   +919999999999 / Owner@123
Trainer: +918888888888 / Trainer@123
Member:  +917777777777 / Member@123
Demo:    +919100000001 … +919100000010 / Member@123
```

## Frontend

```bash
cd client
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check and production build
```

In development, Vite proxies `/api` to the backend, so the browser makes
same-origin requests and no CORS setup is needed.

## Roles

The backend stores three role values: `owner`, `trainer` and `member`.
The `owner` role is displayed as **Admin** throughout the UI — the stored
value is never renamed.

| Capability | Admin | Trainer | Member |
|---|:--:|:--:|:--:|
| Manage plans and coupons | ✓ | | |
| Mark attendance | ✓ | ✓ | |
| Browse plans, buy, use coupons | | | ✓ |
| View own payments and referrals | | | ✓ |

Members do not record their own attendance; a trainer or admin marks it.
The first check-in of a day deducts one day from the member's quota, and a
repeat check-in the same day is treated as re-entry without deducting again.

## Development caveats

**SMS/OTP and Razorpay payments are mocked.** Both are development-only
stand-ins: no message is sent and no money moves. Replace them with real
integrations before any production deployment, and guard the mocks so they
cannot run outside development.

## Known limitations

- Rewards API and reward history are not implemented.
- Coupons created in the UI apply to all plans; the API supports per-plan
  targeting but the form does not expose it.
- The client directory tree still contains empty placeholder files from the
  original scaffold. Live code is under `src/services`, `src/store`,
  `src/lib`, `src/router`, `src/styles` and `src/pages/shared`.
- Integration tests require a running MongoDB and `TEST_MONGODB_URI`.

See `CLAUDE_HANDOFF.md` for architecture notes and product decisions.
