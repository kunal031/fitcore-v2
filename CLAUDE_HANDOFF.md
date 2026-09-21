# FitCore v2 Claude Code Handoff

## Project Location

This is version 2 of the Gym Fitness Portal:

```text
v2/client  React + TypeScript + Vite frontend
v2/server  FastAPI + MongoDB + Beanie backend
```

Version 1 is in `../v1` and is an older Streamlit/FastAPI implementation. Use it only as a reference.

## Product Decisions

- Backend role remains `owner`; frontend displays it as `Admin`.
- Backend role values are `owner`, `trainer`, and `member`.
- Mock SMS/OTP is acceptable during development.
- Mock Razorpay payment is acceptable during development.
- Trainer or Admin records attendance. Members do not scan QR codes.
- Rewards API will be implemented later.
- Rewards will eventually depend on membership duration, gym days used, and plans purchased. Do not add age-based rewards.
- Admin can create, update, activate, and deactivate plans and coupons.
- Members can view plans and use coupons during checkout, but cannot manage coupons.
- Phone number cannot be changed after registration.
- Email cannot be changed after it has been set.
- Use dark and light themes. The main app theme is deep charcoal with electric lime accent and mobile bottom navigation.

## Backend Completed

Main backend entry point:

```text
server/app/main.py
```

API prefix:

```text
/api/v1
```

Implemented areas:

- Auth: register, login, refresh, logout, password change, mock OTP reset
- JWT token-version invalidation on logout
- Users and member profiles
- Plans
- Subscriptions
- Mock payments and payment verification
- Coupons
- Referrals
- Trainer/Admin attendance marking
- Owner and trainer dashboards
- Background expiry/coupon jobs
- MongoDB and Beanie setup

The profile response includes:

- Personal information
- Membership status
- Referral code
- Loyalty points
- Active subscription ID
- Assigned trainer name

Profile updates are handled by:

```text
PATCH /api/v1/users/me
```

The backend rejects changing an existing email with `EMAIL_IMMUTABLE`.

## Demo Data

Run from `v2/server`:

```bash
source venv/bin/activate
python -m app.seed
python -m app.demo_data
```

`app.seed` creates the base Admin, Trainer, Member, plans, coupons, and referrals.

`app.demo_data` creates:

- 5 active demo plans
- 2 inactive/archived demo plans
- 5 demo coupons
- 10 demo members
- 10 active subscriptions
- Demo payments and attendance history

Development accounts:

```text
Admin:   +919999999999 / Owner@123
Trainer: +918888888888 / Trainer@123
Member:  +917777777777 / Member@123
Demo members: +919100000001 through +919100000010 / Member@123
```

Do not commit `.env` files or database credentials.

## Frontend Completed

Frontend entry point:

```text
client/src/main.tsx
```

Current frontend features:

- Vite/React/TypeScript setup
- Axios API client with Vite development proxy
- Zustand auth store
- Login and registration
- Protected route
- Admin/Trainer/Member role labels
- Member dashboard
- Dark/light theme toggle
- Deep charcoal/electric lime visual system
- Mobile bottom navigation
- Member plans and current subscription display
- Previous subscription display
- Mock payment checkout and subscription activation
- Attendance statistics and history from subscription data
- Referral code copy/share flow
- Registration referral code via `/register?ref=CODE`
- Member profile display and editing
- Locked phone and email fields in profile
- Coupon validation during checkout with itemised discount lines
- Member payment history with expandable receipt detail
- Admin plan management (create, edit, activate, deactivate)
- Admin coupon management (create, activate, deactivate)
- Trainer/Admin member list with search and attendance marking

Main frontend workspace:

```text
client/src/pages/shared/DashboardPage.tsx
```

Frontend development command:

```bash
cd v2/client
npm install
npm run dev
```

Build check:

```bash
npm run build
```

## Running The Backend

From `v2/server`:

```bash
source venv/bin/activate
uvicorn app.main:app --reload
```

Health check:

```text
http://localhost:8000/health
```

The frontend normally runs at:

```text
http://localhost:5173
```

## Important Known Limitations

- Rewards API and reward history are not implemented.
- Referral endpoint has stale-data repair logic for old seed records.
- Member bottom navigation now holds six tabs, which is the practical
  maximum for mobile width. Further member sections should nest under
  Profile rather than being added to the navigation bar.
- Coupons created in the frontend always apply to all plans;
  per-plan targeting is supported by the API but not yet exposed.
- The client directory tree contains empty placeholder files from the
  original scaffold. Live code is under services, store, lib, router,
  styles and pages/shared.
- SMS delivery is mocked and currently development-only.
- Razorpay is mocked and currently development-only.
- MongoDB integration tests require a running MongoDB and `TEST_MONGODB_URI`.

## Recommended Next Work

Items 1 to 5 of the previous list are complete. Remaining:

1. Add better profile update feedback and API error handling.
2. Add rewards placeholder only until the Rewards API is ready.
3. Expose per-plan coupon targeting in Admin coupon management.
4. Split the member dashboard into separate page components; it now
   carries every member view in one file.

## Instructions For Claude Code

Before editing:

1. Read this file.
2. Inspect the current files because the user may have made changes after this handoff.
3. Preserve backend role value `owner`; only display `Admin` in the frontend.
4. Keep mock SMS and mock payments unless the user explicitly asks to replace them.
5. Run `npm run build` after frontend changes.
6. Run backend compile/tests after backend changes.
7. Do not overwrite user changes or commit automatically.
