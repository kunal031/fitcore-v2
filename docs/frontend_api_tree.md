# 🌳 FitCore v2 — Frontend API Route Tree & Data Specifications

This document serves as the **Frontend Developer's Integration Manual**. It maps all 55 backend REST endpoints to their corresponding frontend UI views, Zustand stores, payload shapes, and data flow.

---

## 🗺️ Master Tree Overview

```
/ (Base API: http://127.0.0.1:8000)
├── ⚙️ System & Health
│   ├── GET  /
│   └── GET  /health
│
└── 🌐 /api/v1
    ├── 🔐 Auth (/auth)
    │   ├── POST   /register
    │   ├── POST   /login
    │   ├── POST   /refresh
    │   ├── POST   /logout
    │   ├── PATCH  /change-password
    │   ├── POST   /send-otp
    │   ├── POST   /verify-otp
    │   └── POST   /reset-password
    │
    ├── 👤 Users (/users)
    │   ├── GET    /me
    │   ├── PATCH  /me
    │   ├── GET    /
    │   ├── POST   /
    │   ├── GET    /trainers
    │   ├── GET    /{user_id}
    │   ├── PATCH  /{user_id}/status
    │   ├── POST   /{user_id}/assign-trainer
    │   └── GET    /{user_id}/qr
    │
    ├── 🏋️ Fitness Plans (/plans)
    │   ├── GET    /
    │   ├── GET    /all
    │   ├── POST   /
    │   ├── GET    /{plan_id}
    │   ├── PATCH  /{plan_id}
    │   ├── PATCH  /{plan_id}/deactivate
    │   └── PATCH  /{plan_id}/activate
    │
    ├── 🎫 Subscriptions (/subscriptions)
    │   ├── GET    /me
    │   ├── GET    /me/history
    │   ├── GET    /expiring
    │   ├── GET    /{sub_id}
    │   ├── POST   /{sub_id}/pause
    │   ├── POST   /{sub_id}/resume
    │   └── POST   /{sub_id}/cancel
    │
    ├── 📲 Check-In & Attendance (/checkin)
    │   ├── POST   /
    │   ├── GET    /today
    │   └── GET    /history
    │
    ├── 💳 Payments & Checkout (/payments)
    │   ├── POST   /initiate
    │   ├── POST   /verify
    │   ├── POST   /manual
    │   ├── GET    /me
    │   └── GET    /
    │
    ├── 🏷️ Coupons & Offers (/coupons)
    │   ├── GET    /
    │   ├── POST   /
    │   ├── GET    /validate/{code}
    │   ├── GET    /{coupon_id}
    │   ├── PATCH  /{coupon_id}
    │   └── PATCH  /{coupon_id}/deactivate
    │
    ├── 🤝 Referrals & Growth (/referrals)
    │   ├── GET    /me
    │   └── GET    /
    │
    └── 📊 Dashboards (/dashboard)
        ├── GET    /owner
        └── GET    /trainer
```

---

## 1. System & Health

| Method | Endpoint | Access | UI Component / View |
|---|---|---|---|
| `GET` | `/` | Public | Status indicator |
| `GET` | `/health` | Public | Offline/Online banner |

- **Data Out:** `{"success": true, "status": "healthy", "database": "connected"}`
- **Frontend Action:** Call periodically or on app boot to display an offline alert if the server is unreachable.

---

## 2. Authentication (`/api/v1/auth`)

### `POST /api/v1/auth/register`
- **UI Screen:** `RegisterPage.tsx`
- **Access:** Public
- **Data In (Body):**
  ```json
  {
    "full_name": "Arjun Patil",
    "phone": "9876543210",
    "email": "arjun@example.com",
    "password": "Password123",
    "referral_code": "OWNER001"
  }
  ```
- **Data Out (201):** User profile, `access_token`, `refresh_token`.
- **Frontend Action:** Save tokens in `localStorage` + `authStore`, redirect to `/member/home`.

---

### `POST /api/v1/auth/login`
- **UI Screen:** `LoginPage.tsx`
- **Access:** Public
- **Data In (Body):**
  ```json
  {
    "identifier": "owner@fitcore.in", // OR phone "+919999999999"
    "password": "Owner@123"
  }
  ```
- **Data Out (200):**
  ```json
  {
    "user": {
      "id": "66dd...",
      "full_name": "Gym Owner",
      "phone": "+919999999999",
      "role": "owner",
      "membership_status": "active"
    },
    "access_token": "eyJhb...",
    "refresh_token": "eyJhb..."
  }
  ```
- **Frontend Action:** Store tokens in `authStore`. Read `user.role` to navigate:
  - `owner` ➔ `/owner/dashboard`
  - `trainer` ➔ `/trainer/dashboard`
  - `member` ➔ `/member/home`

---

### `POST /api/v1/auth/refresh`
- **Trigger:** Axios Interceptor on `401 Unauthorized`.
- **Data In (Body):** `{"refresh_token": "eyJhb..."}`
- **Data Out (200):** New `access_token` and `refresh_token`.
- **Frontend Action:** Update tokens silently in background without logging the user out.

---

### `POST /api/v1/auth/logout`
- **UI Element:** Logout button in `TopBar.tsx` / `AccountSettingsPage.tsx`.
- **Headers:** `Authorization: Bearer <access_token>`
- **Frontend Action:** Clear `localStorage`, reset `authStore`, redirect to `/login`.

---

### `PATCH /api/v1/auth/change-password`
- **UI Screen:** `ChangePasswordPage.tsx`
- **Data In (Body):** `{"old_password": "...", "new_password": "..."}`
- **Data Out (200):** `{"data": {"updated": true}}`

---

### `POST /api/v1/auth/send-otp` & `/verify-otp` & `/reset-password`
- **UI Screen:** `OTPPage.tsx` / Forgot Password flow.
- **Data In:** Phone number ➔ receives temporary reset token ➔ sends new password.

---

## 3. Users & Members (`/api/v1/users`)

### `GET /api/v1/users/me`
- **UI View:** Profile drawer, user avatar, settings.
- **Access:** All logged-in roles.
- **Data Out:** Full profile, address, loyalty points, active subscription ID.

---

### `PATCH /api/v1/users/me`
- **UI Screen:** Edit Profile form.
- **Data In (Body):**
  ```json
  {
    "full_name": "Arjun Patil",
    "email": "arjun.new@gmail.com",
    "dob": "1998-05-20",
    "blood_group": "O+",
    "address": {
      "city": "Pune",
      "state": "Maharashtra",
      "pincode": "411045"
    }
  }
  ```

---

### `GET /api/v1/users?page=1&limit=20&search=arjun&role=member`
- **UI Screen:** `OwnerMembersPage.tsx` / `TrainerMemberListPage.tsx`
- **Access:** Owner, Trainer
- **Query Params:** `page`, `limit`, `search`, `role`, `status` (active/expired).
- **Data Out:** Paginated list of members with status and details.

---

### `POST /api/v1/users`
- **UI Component:** "Add Member / Trainer" modal on `OwnerMembersPage.tsx`.
- **Access:** Owner only.
- **Data In (Body):** `{"full_name": "...", "phone": "...", "password": "...", "role": "member"}`.

---

### `GET /api/v1/users/trainers`
- **UI Component:** Trainer dropdown selector when assigning staff.
- **Access:** Owner only.
- **Data Out:** List of all active trainers.

---

### `GET /api/v1/users/{user_id}/qr`
- **UI Screen:** `MemberHomePage.tsx` (QR modal) or `TrainerMemberDetailPage.tsx`.
- **Data Out:** `{"qr_data": "fitcore:member:66dd..."}`.
- **Frontend Action:** Render as a scannable QR code on the member's phone.

---

## 4. Fitness Plans (`/api/v1/plans`)

### `GET /api/v1/plans`
- **UI Screen:** `MemberStorePage.tsx` (Catalog).
- **Access:** All roles.
- **Data Out:** List of active plans with `price_paise`, `allocated_days`, `features`.
- **Frontend Action:** Convert `price_paise` to INR display: `₹{price_paise / 100}`.

---

### `GET /api/v1/plans/all`
- **UI Screen:** `OwnerPlansPage.tsx`.
- **Access:** Owner only.
- **Data Out:** Both active and deactivated plans for admin inventory management.

---

### `POST /api/v1/plans` & `PATCH /api/v1/plans/{id}`
- **UI Component:** `PlanFormSheet.tsx` (Create / Edit plan drawer).
- **Access:** Owner only.
- **Data In (Body):**
  ```json
  {
    "plan_name": "Diamond Quarterly",
    "category": "premium",
    "price_paise": 450000,
    "calendar_days": 90,
    "allocated_days": 78,
    "features": ["All Equipments", "Steam Bath", "Personal Trainer"]
  }
  ```

---

### `PATCH /api/v1/plans/{id}/deactivate` & `/activate`
- **UI Element:** Toggle switch on plan card in `OwnerPlansPage.tsx`.

---

## 5. Subscriptions (`/api/v1/subscriptions`)

### `GET /api/v1/subscriptions/me`
- **UI Component:** `SubscriptionCard.tsx` (Circular progress ring on Member Home).
- **Access:** Member.
- **Data Out:**
  ```json
  {
    "status": "active",
    "allocated_days": 26,
    "days_used": 5,
    "days_remaining": 21,
    "starts_on": "2026-09-01",
    "expires_on": "2026-10-01",
    "days_until_expiry": 22,
    "attendance_log": [...]
  }
  ```
- **Frontend Action:** Renders circular day tracker: `(days_remaining / allocated_days) * 100`.

---

### `GET /api/v1/subscriptions/me/history`
- **UI Screen:** `MemberHistoryPage.tsx`.
- **Data Out:** All historical passes with check-in dates and receipts.

---

### `GET /api/v1/subscriptions/expiring?days=7`
- **UI Component:** "Expiring in 7 Days" widget on Owner & Trainer dashboards.
- **Data Out:** List of members with `< 7 days` remaining. Allows 1-click WhatsApp/Call renewal reminder.

---

### `POST /api/v1/subscriptions/{id}/pause` & `/resume` & `/cancel`
- **UI Component:** Subscription options menu in Owner Member Details.

---

## 6. Check-In & Attendance (`/api/v1/checkin`)

### `POST /api/v1/checkin`
- **UI Screen:** `TrainerScanPage.tsx` (QR scanner camera view + phone search input).
- **Access:** Trainer, Owner.
- **Data In (Body):** `{"member_id": "66dd..."}` OR `{"phone": "9876543210"}`.
- **Data Out (200):**
  ```json
  {
    "member": {
      "full_name": "Arjun Patil",
      "avatar_url": null
    },
    "days_remaining": 20,
    "allocated_days": 26,
    "is_first_today": true
  }
  ```
- **Frontend Action:** 
  - If `is_first_today: true`: Green modal with ding sound: *"Welcome, Arjun! 20 days left."*
  - If `is_first_today: false`: Blue modal: *"Welcome back, Arjun! (Re-entry today)"*.

---

### `GET /api/v1/checkin/today`
- **UI Component:** `AttendanceList.tsx` on Trainer and Owner Dashboards.
- **Data Out:** Real-time feed of members currently in the gym today.

---

## 7. Payments & Checkout (`/api/v1/payments`)

### `POST /api/v1/payments/initiate`
- **UI Component:** `CheckoutDrawer.tsx`.
- **Data In (Body):**
  ```json
  {
    "plan_id": "66dd...",
    "coupon_code": "WELCOME10",
    "referral_code": "FIT2026"
  }
  ```
- **Data Out (200):** Razorpay `order_id`, `razorpay_key_id`, and `final_paise`.
- **Frontend Action:** Loads Razorpay modal (`useRazorpay.ts`) using the returned `order_id`.

---

### `POST /api/v1/payments/verify`
- **Trigger:** Razorpay payment success callback.
- **Data In (Body):**
  ```json
  {
    "payment_id": "...",
    "razorpay_order_id": "order_...",
    "razorpay_payment_id": "pay_...",
    "razorpay_signature": "hmac_..."
  }
  ```
- **Frontend Action:** Closes payment sheet, shows celebration screen, refreshes `subscriptionStore`.

---

### `POST /api/v1/payments/manual`
- **UI Screen:** "Record Counter Payment" sheet on `OwnerPaymentsPage.tsx`.
- **Access:** Owner, Trainer.
- **Data In (Body):**
  ```json
  {
    "member_id": "66dd...",
    "plan_id": "66dd...",
    "payment_method": "cash", // or "upi"
    "amount_paise": 150000,
    "upi_ref": "4081293821",
    "note": "Paid cash at counter"
  }
  ```

---

## 8. Coupons (`/api/v1/coupons`)

### `GET /api/v1/coupons/validate/{code}?plan_id={id}`
- **UI Component:** Coupon input box in `CheckoutDrawer.tsx`.
- **Access:** Member.
- **Data Out:**
  ```json
  {
    "valid": true,
    "discount_paise": 15000,
    "final_paise": 135000,
    "description": "10% off"
  }
  ```
- **Frontend Action:** Shows instant discount breakdown before the user taps "Pay".

---

### `GET /api/v1/coupons` & `POST /api/v1/coupons`
- **UI Screen:** `OwnerCouponsPage.tsx`.
- **Access:** Owner only. Allows creating promotional festival coupons.

---

## 9. Referrals (`/api/v1/referrals`)

### `GET /api/v1/referrals/me`
- **UI Screen:** `MemberReferralPage.tsx` ("Invite & Earn").
- **Access:** Member.
- **Data Out:**
  ```json
  {
    "my_referral_code": "ARJUN001",
    "shareable_link": "https://fitcore.in/join?ref=ARJUN001",
    "stats": {
      "total_referrals": 5,
      "successful_joins": 3,
      "total_points_earned": 1500
    },
    "referred_members": [...]
  }
  ```
- **Frontend Action:** Provides 1-tap "Share on WhatsApp" and "Copy Link" buttons.

---

## 10. Dashboards & Analytics (`/api/v1/dashboard`)

### `GET /api/v1/dashboard/owner`
- **UI Screen:** `OwnerDashboardPage.tsx`.
- **Access:** Owner only.
- **Data Out:**
  ```json
  {
    "stats": {
      "total_members": 150,
      "active_subscriptions": 120,
      "checkins_today": 42,
      "revenue_this_month_paise": 18500000,
      "revenue_change_percent": 12.5
    },
    "expiring_soon_count": 8,
    "recent_payments": [...],
    "popular_plan": { "plan_name": "Gold Monthly", "active_count": 65 }
  }
  ```
- **Frontend Action:** Powers the 4 KPI cards (`StatsCard.tsx`) and the monthly revenue chart.

---

### `GET /api/v1/dashboard/trainer`
- **UI Screen:** `TrainerDashboardPage.tsx`.
- **Access:** Trainer, Owner.
- **Data Out:** `checkins_today`, `expiring_soon_count`, and last scanned attendee.
