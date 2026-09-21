# 📖 FitCore v2 — Complete Backend Route Encyclopedia (All Endpoints)

This document is the **single source of truth** connecting the FastAPI backend to the React frontend. Every single screen, button, form, and modal in the frontend corresponds to one of these routes.

---

## 📑 Summary of Route Groups

| Group | Router Module | Route Count | Primary Function |
|---|---|---|---|
| **0. System & Health** | `main.py` | 2 | Server liveness & database monitoring |
| **1. Authentication** | `routes/auth.py` | 8 | Login (phone/email), signup, tokens, password recovery |
| **2. Users & Staff** | `routes/users.py` | 9 | Member directory, profile editing, QR code generation, staff roles |
| **3. Fitness Plans** | `routes/plans.py` | 7 | Plan catalog, pricing in paise, features, admin inventory |
| **4. Subscriptions** | `routes/subscriptions.py` | 7 | Active pass day-tracking, expiry calculation, freeze/unfreeze |
| **5. Check-In & Entry** | `routes/checkin.py` | 3 | Physical gym entry, daily deduplication, live attendee feed |
| **6. Payments & Billing** | `routes/payments.py` | 5 | Razorpay checkout, signature verification, manual cash logging |
| **7. Coupons & Offers** | `routes/coupons.py` | 6 | Promo codes, instant discount previews, usage limits |
| **8. Referrals & Growth** | `routes/referrals.py` | 2 | Referral codes, invited members tracking, loyalty rewards |
| **9. Dashboards** | `routes/dashboard.py` | 2 | Aggregated business KPIs, revenue charts, staff stats |
| **Total Registered** | | **51 API Routes + System/Docs = 55** | |

---

## Group 0 — System & Health

### 1. `GET /`
- **Purpose:** Root ping check.
- **Access:** Public (No token).
- **Data In:** None.
- **Data Out:**
  ```json
  { "name": "FitCore Gym Management API", "version": "2.0.0", "status": "online" }
  ```
- **Frontend Usage:** Verification that the API server is responding.

### 2. `GET /health`
- **Purpose:** Health check probing MongoDB Atlas connectivity.
- **Access:** Public (No token).
- **Data In:** None.
- **Data Out:**
  ```json
  { "success": true, "status": "healthy", "database": "connected", "version": "2.0.0" }
  ```
- **Frontend Usage:** App bootstrap (`AppLayout.tsx`). If `database == "disconnected"`, shows an offline banner.

---

## Group 1 — Authentication (`/api/v1/auth`)

### 3. `POST /api/v1/auth/register`
- **Purpose:** New member self-registration.
- **Access:** Public.
- **Data In (Body):**
  ```json
  {
    "full_name": "Arjun Patil",
    "phone": "9876543210",
    "email": "arjun@gmail.com",
    "password": "Password123",
    "referral_code": "OWNER001" // optional
  }
  ```
- **Backend Logic:**
  1. Validates phone format and converts to `+919876543210`.
  2. Ensures phone and email are not duplicates.
  3. Hashes password using bcrypt.
  4. Generates unique referral code for this new user.
  5. Links referral if code provided.
  6. Generates JWT access token (15 min) and refresh token (30 days).
- **Data Out (201):**
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "...", "full_name": "Arjun Patil", "phone": "+919876543210", "role": "member", "membership_status": "inactive" },
      "access_token": "eyJhbGciOi...",
      "refresh_token": "eyJhbGciOi...",
      "token_type": "bearer"
    },
    "message": "Welcome to FitCore, Arjun Patil!"
  }
  ```
- **Frontend Screen:** `RegisterPage.tsx`. On success, stores tokens in `authStore` and navigates to member home.

### 4. `POST /api/v1/auth/login`
- **Purpose:** Authenticate Owner, Trainer, or Member.
- **Access:** Public.
- **Data In (Body):**
  ```json
  {
    "identifier": "owner@fitcore.in", // Accepts either email OR phone "+919999999999"
    "password": "Owner@123"
  }
  ```
- **Backend Logic:**
  1. Checks if `@` is in identifier ➔ searches by email (case-insensitive); else standardizes phone and searches by phone.
  2. Verifies password hash using constant-time comparison.
  3. Checks `is_active` flag.
  4. Issues JWT access & refresh tokens containing `sub: user_id` and `role`.
- **Data Out (200):** Same structure as Register (`TokenResponse`).
- **Frontend Screen:** `LoginPage.tsx`. Routes based on `user.role`:
  - `owner` ➔ `/owner/dashboard`
  - `trainer` ➔ `/trainer/dashboard`
  - `member` ➔ `/member/home`

### 5. `POST /api/v1/auth/refresh`
- **Purpose:** Silently obtain a new access token without logging the user out.
- **Access:** Public (uses refresh token in body).
- **Data In (Body):**
  ```json
  { "refresh_token": "eyJhbGci..." }
  ```
- **Data Out (200):** Fresh `access_token` and `refresh_token`.
- **Frontend Component:** `lib/axios.ts` interceptor. Catches any `401 Unauthorized`, calls this route, updates headers, and retries the original request seamlessly.

### 6. `POST /api/v1/auth/logout`
- **Purpose:** Invalidate session.
- **Access:** Authenticated (Any role).
- **Data In:** Header `Authorization: Bearer <access_token>`.
- **Data Out (200):** `{"data": {"logged_out": true}}`.
- **Frontend Component:** Logout button in `TopBar.tsx`. Clears Zustand store and `localStorage`.

### 7. `PATCH /api/v1/auth/change-password`
- **Purpose:** Update password for logged-in user.
- **Access:** Authenticated (Any role).
- **Data In (Body):**
  ```json
  { "old_password": "OldPassword123", "new_password": "NewPassword123" }
  ```
- **Data Out (200):** `{"data": {"updated": true}, "message": "Password changed successfully."}`
- **Frontend Screen:** `ChangePasswordPage.tsx`.

### 8. `POST /api/v1/auth/send-otp`
- **Purpose:** Send OTP to phone for password reset.
- **Access:** Public.
- **Data In (Body):** `{"phone": "9876543210"}`.
- **Data Out (200):** `{"data": {"sent": true, "phone": "+919876543210"}}`.
- **Frontend Screen:** `OTPPage.tsx`.

### 9. `POST /api/v1/auth/verify-otp`
- **Purpose:** Verify OTP code.
- **Access:** Public.
- **Data In (Body):** `{"phone": "9876543210", "otp": "4521"}`.
- **Data Out (200):** `{"data": {"verified": true, "reset_token": "reset_..."}}`.
- **Frontend Screen:** Step 2 of `OTPPage.tsx`.

### 10. `POST /api/v1/auth/reset-password`
- **Purpose:** Submit new password with verified reset token.
- **Access:** Public.
- **Data In (Body):**
  ```json
  { "phone": "9876543210", "reset_token": "reset_...", "new_password": "NewPassword123" }
  ```
- **Data Out (200):** `{"data": {"reset": true}}`.
- **Frontend Screen:** Step 3 of `OTPPage.tsx`. Redirects to `/login`.

---

## Group 2 — Users & Staff (`/api/v1/users`)

### 11. `GET /api/v1/users/me`
- **Purpose:** Get full profile of the currently logged-in user.
- **Access:** Authenticated (All roles).
- **Data Out (200):**
  ```json
  {
    "id": "66dd...",
    "full_name": "Arjun Patil",
    "phone": "+919876543210",
    "email": "arjun@gmail.com",
    "role": "member",
    "profile": { "dob": "1998-05-20", "blood_group": "B+", "gender": "male", "avatar_url": null, "address": { "city": "Pune", "state": "Maharashtra", "pincode": "411045" } },
    "gym_meta": { "joined_on": "2026-09-01", "membership_status": "active", "assigned_trainer_id": "66de..." },
    "active_subscription_id": "66df...",
    "my_referral_code": "ARJUN001",
    "loyalty_points": 250,
    "is_active": true
  }
  ```
- **Frontend Usage:** Loaded on startup into `authStore.user`. Populates user drawers, avatars, and loyalty points badges.

### 12. `PATCH /api/v1/users/me`
- **Purpose:** Update personal profile details.
- **Access:** Authenticated (All roles).
- **Data In (Body):**
  ```json
  {
    "full_name": "Arjun Patil",
    "email": "arjun.new@gmail.com",
    "dob": "1998-05-20",
    "blood_group": "B+",
    "address": { "city": "Pune", "pincode": "411045" }
  }
  ```
- **Data Out (200):** Updated `UserRead` object.
- **Frontend Screen:** `MemberProfilePage.tsx` / `AccountSettingsPage.tsx`.

### 13. `GET /api/v1/users`
- **Purpose:** Searchable and paginated directory of members.
- **Access:** Owner, Trainer.
- **Query Params:** `?page=1&limit=20&search=arjun&role=member&status=active`.
- **Data Out (200):**
  ```json
  {
    "success": true,
    "data": {
      "items": [ { ...UserRead 1 }, { ...UserRead 2 } ],
      "meta": { "page": 1, "limit": 20, "total": 142, "pages": 8 }
    }
  }
  ```
- **Frontend Screen:** `OwnerMembersPage.tsx` and `TrainerMemberListPage.tsx` (`MemberTable.tsx`).

### 14. `POST /api/v1/users`
- **Purpose:** Owner manually creates a member or trainer account.
- **Access:** Owner only.
- **Data In (Body):**
  ```json
  {
    "full_name": "Rohan Deshmukh",
    "phone": "9822001122",
    "password": "TempPassword123",
    "role": "member", // or "trainer"
    "email": "rohan@example.com"
  }
  ```
- **Data Out (201):** Newly created `UserRead` object.
- **Frontend Component:** "Add Member" modal on `OwnerMembersPage.tsx`.

### 15. `GET /api/v1/users/trainers`
- **Purpose:** Fetch list of all active trainers.
- **Access:** Owner only.
- **Data Out (200):** Array of `UserRead` objects with `role: "trainer"`.
- **Frontend Usage:** Populates dropdown selector in `OwnerMemberDetailPage.tsx` for staff assignment.

### 16. `GET /api/v1/users/{user_id}`
- **Purpose:** Get full profile of any specific member.
- **Access:** Owner, Trainer.
- **Data Out (200):** Full `UserRead` document.
- **Frontend Screen:** `OwnerMemberDetailPage.tsx` and `TrainerMemberDetailPage.tsx`.

### 17. `PATCH /api/v1/users/{user_id}/status`
- **Purpose:** Suspend or activate a member account.
- **Access:** Owner only.
- **Data In (Body):** `{"is_active": false, "membership_status": "suspended"}`.
- **Data Out (200):** Updated `UserRead`.
- **Frontend Element:** "Suspend / Activate Member" toggle in member detail view.

### 18. `POST /api/v1/users/{user_id}/assign-trainer`
- **Purpose:** Assign a personal trainer to a member.
- **Access:** Owner only.
- **Data In (Body):** `{"trainer_id": "66de..."}`.
- **Data Out (200):** Updated `UserRead` with `gym_meta.assigned_trainer_id`.
- **Frontend Component:** "Assign Trainer" dropdown in member details.

### 19. `GET /api/v1/users/{user_id}/qr`
- **Purpose:** Returns the QR code string for gym entrance scanning.
- **Access:** Owner, Trainer, or Member (own ID only).
- **Data Out (200):**
  ```json
  { "data": { "member_id": "66dd...", "qr_data": "fitcore:member:66dd..." } }
  ```
- **Frontend Component:** `MemberHomePage.tsx` QR modal. Rendered using `react-qr-code`.

---

## Group 3 — Fitness Plans (`/api/v1/plans`)

### 20. `GET /api/v1/plans`
- **Purpose:** List all active fitness plans available for purchase.
- **Access:** Public / All Authenticated Roles.
- **Data Out (200):**
  ```json
  [
    {
      "id": "66df...",
      "plan_name": "Gold Monthly",
      "description": "Full access with steam bath & trainer session",
      "category": "standard",
      "price_paise": 150000, // ₹1,500
      "calendar_days": 30,
      "allocated_days": 26,
      "features": ["Gym Access", "Locker Room", "Steam Bath"],
      "is_active": true
    }
  ]
  ```
- **Frontend Screen:** `MemberStorePage.tsx` (`PlanCard.tsx`).

### 21. `GET /api/v1/plans/all`
- **Purpose:** List all plans including inactive ones for inventory control.
- **Access:** Owner only.
- **Data Out (200):** Complete array of all `PlanRead` objects.
- **Frontend Screen:** `OwnerPlansPage.tsx`.

### 22. `POST /api/v1/plans`
- **Purpose:** Owner creates a new plan.
- **Access:** Owner only.
- **Data In (Body):**
  ```json
  {
    "plan_name": "Platinum Annual",
    "description": "Year-round unrestricted membership with nutrition consultation",
    "category": "premium",
    "price_paise": 1200000,
    "calendar_days": 365,
    "allocated_days": 312,
    "features": ["365 Days Access", "Diet Consultation", "VIP Lockers"]
  }
  ```
- **Data Out (201):** Newly created `PlanRead` object.
- **Frontend Component:** `PlanFormSheet.tsx`.

### 23. `GET /api/v1/plans/{plan_id}`
- **Purpose:** Get full details of one specific plan.
- **Access:** All roles.
- **Frontend Screen:** Plan detail preview before checkout.

### 24. `PATCH /api/v1/plans/{plan_id}`
- **Purpose:** Update pricing, days, or features of an existing plan.
- **Access:** Owner only.
- **Data In (Body):** Any subset of `PlanUpdate` fields.
- **Frontend Component:** "Edit Plan" mode in `PlanFormSheet.tsx`.

### 25. `PATCH /api/v1/plans/{plan_id}/deactivate`
- **Purpose:** Soft-delete plan (hides from member store without breaking past subscription snapshots).
- **Access:** Owner only.
- **Frontend Action:** "Archive Plan" button.

### 26. `PATCH /api/v1/plans/{plan_id}/activate`
- **Purpose:** Restore an archived plan back to the member store.
- **Access:** Owner only.
- **Frontend Action:** "Restore Plan" button.

---

## Group 4 — Subscriptions & Quotas (`/api/v1/subscriptions`)

### 27. `GET /api/v1/subscriptions/me`
- **Purpose:** Fetch the logged-in member's currently active gym pass.
- **Access:** Member only.
- **Data Out (200):**
  ```json
  {
    "id": "66e0...",
    "user_id": "66dd...",
    "plan_id": "66df...",
    "plan_snapshot": { "plan_name": "Gold Monthly", "price_paise": 150000, "allocated_days": 26, "calendar_days": 30, "features": [...] },
    "status": "active",
    "allocated_days": 26,
    "days_used": 5,
    "days_remaining": 21,
    "starts_on": "2026-09-01",
    "expires_on": "2026-10-01",
    "days_until_expiry": 22,
    "attendance_log": [
      { "date": "2026-09-02", "check_in_time": "2026-09-02T06:30:00Z", "marked_by": "66de..." }
    ]
  }
  ```
- **Frontend Component:** `SubscriptionCard.tsx` (Circular progress ring on Member Home) and `AttendanceCalendar.tsx`.

### 28. `GET /api/v1/subscriptions/me/history`
- **Purpose:** View all past expired or completed passes.
- **Access:** Member only.
- **Data Out (200):** Array of `SubscriptionRead` objects.
- **Frontend Screen:** `MemberHistoryPage.tsx`.

### 29. `GET /api/v1/subscriptions/expiring?days=7`
- **Purpose:** Get members whose pass expires in the next 7 days.
- **Access:** Owner, Trainer.
- **Data Out (200):**
  ```json
  [
    {
      "subscription_id": "66e0...",
      "member_id": "66dd...",
      "member_name": "Arjun Patil",
      "member_phone": "+919876543210",
      "plan_name": "Gold Monthly",
      "days_remaining": 2,
      "expires_on": "2026-09-15",
      "days_until_expiry": 6
    }
  ]
  ```
- **Frontend Component:** "Expiring Soon" widget on Owner & Trainer dashboards. Has quick "Send WhatsApp Reminder" button.

### 30. `GET /api/v1/subscriptions/{sub_id}`
- **Purpose:** Inspect any specific subscription record.
- **Access:** Owner, Trainer.

### 31. `POST /api/v1/subscriptions/{sub_id}/pause`
- **Purpose:** Temporarily freeze a pass (for member sickness/travel).
- **Access:** Owner only.
- **Backend Logic:** Sets `status: "paused"`. Member cannot check in while paused.
- **Frontend Action:** "Freeze Subscription" action in member detail.

### 32. `POST /api/v1/subscriptions/{sub_id}/resume`
- **Purpose:** Unfreeze a paused pass.
- **Access:** Owner only.
- **Backend Logic:** Sets `status: "active"`.
- **Frontend Action:** "Unfreeze Subscription" action.

### 33. `POST /api/v1/subscriptions/{sub_id}/cancel`
- **Purpose:** Cancel a subscription early.
- **Access:** Owner only.
- **Backend Logic:** Sets `status: "cancelled"`, clears `user.active_subscription_id`, sets `gym_meta.membership_status: "inactive"`.

---

## Group 5 — Check-In & Attendance (`/api/v1/checkin`)

### 34. `POST /api/v1/checkin`
- **Purpose:** Record member arrival at gym entrance.
- **Access:** Trainer, Owner.
- **Data In (Body):**
  ```json
  { "member_id": "66dd..." } // From QR Scan
  // OR
  { "phone": "9876543210" }   // Manual phone search
  ```
- **Backend Logic (The Core Business Logic):**
  1. Finds member and their active subscription.
  2. Rejects if calendar expired or days remaining <= 0.
  3. Checks if `today` (UTC YYYY-MM-DD) already exists in `attendance_log`:
     - **If NOT in log (1st entry today):** Appends entry, increments `days_used += 1`, decrements `days_remaining -= 1`. If `days_remaining == 0`, sets `status: "exhausted"`. Sets `is_first_today: true`.
     - **If ALREADY in log (Re-entry today):** Does NOT deduct day! Sets `is_first_today: false`.
- **Data Out (200):**
  ```json
  {
    "success": true,
    "data": {
      "member": { "id": "66dd...", "full_name": "Arjun Patil", "phone": "+919876543210", "avatar_url": null },
      "check_in_time": "2026-09-09T07:15:00Z",
      "days_remaining": 20,
      "allocated_days": 26,
      "is_first_today": true
    },
    "message": "✅ Welcome, Arjun Patil! 20 days remaining."
  }
  ```
- **Frontend Screen:** `TrainerScanPage.tsx`. Green celebration banner on 1st entry; Blue re-entry banner on same day return.

### 35. `GET /api/v1/checkin/today`
- **Purpose:** Real-time feed of all members currently in the gym today.
- **Access:** Trainer, Owner.
- **Data Out (200):**
  ```json
  [
    {
      "member": { "id": "66dd...", "full_name": "Arjun Patil", "phone": "+919876543210" },
      "check_in_time": "2026-09-09T07:15:00Z",
      "days_remaining": 20
    }
  ]
  ```
- **Frontend Component:** `AttendanceList.tsx` on Trainer and Owner dashboards.

### 36. `GET /api/v1/checkin/history?member_id={id}`
- **Purpose:** Full check-in calendar history for a member.
- **Access:** Trainer, Owner.
- **Frontend Screen:** `TrainerMemberDetailPage.tsx`.

---

## Group 6 — Payments & Billing (`/api/v1/payments`)

### 37. `POST /api/v1/payments/initiate`
- **Purpose:** Start checkout before opening payment gateway.
- **Access:** Member only.
- **Data In (Body):**
  ```json
  {
    "plan_id": "66df...",
    "coupon_code": "WELCOME10", // optional
    "referral_code": "OWNER001"  // optional
  }
  ```
- **Backend Logic:**
  1. Validates plan price in paise.
  2. Atomically validates coupon and computes discount.
  3. Computes referral discount if applicable.
  4. Generates unique sequential receipt: `FIT-2026-XXXXXX`.
  5. Creates Razorpay Order via Razorpay SDK with `final_amount_paise`.
  6. Creates `PaymentDocument` in MongoDB with `status: "pending"`.
- **Data Out (200):**
  ```json
  {
    "payment_id": "66e1...",
    "razorpay_order_id": "order_xxx...",
    "razorpay_key_id": "rzp_test_...",
    "amount_paise": 135000,
    "currency": "INR",
    "discount_breakdown": {
      "original_paise": 150000,
      "coupon_discount_paise": 15000,
      "referral_discount_paise": 0,
      "final_paise": 135000
    },
    "prefill": { "name": "Arjun Patil", "contact": "+919876543210" }
  }
  ```
- **Frontend Component:** `CheckoutDrawer.tsx`. Passes response directly into Razorpay Checkout script (`useRazorpay.ts`).

### 38. `POST /api/v1/payments/verify`
- **Purpose:** Confirm payment success and activate gym pass.
- **Access:** Member only.
- **Data In (Body):**
  ```json
  {
    "payment_id": "66e1...",
    "razorpay_payment_id": "pay_xxx...",
    "razorpay_order_id": "order_xxx...",
    "razorpay_signature": "hmac_signature..."
  }
  ```
- **Backend Logic:**
  1. Verifies Razorpay HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET`.
  2. Updates Payment `status: "success"`.
  3. **Creates active `SubscriptionDocument` in MongoDB**.
  4. Updates `user.active_subscription_id` and `membership_status: "active"`.
  5. Increments coupon usage counter.
  6. Dispatches referral reward to referrer if applicable.
- **Data Out (200):** Confirmed `PaymentRead` object with receipt number.
- **Frontend Screen:** Triggers success modal, refreshes `subscriptionStore`, and routes to `/member/home`.

### 39. `POST /api/v1/payments/manual`
- **Purpose:** Counter staff records cash or offline UPI payments.
- **Access:** Trainer, Owner.
- **Data In (Body):**
  ```json
  {
    "member_id": "66dd...",
    "plan_id": "66df...",
    "payment_method": "cash", // or "upi"
    "amount_paise": 150000,
    "upi_ref": "4081928374", // optional
    "note": "Paid cash at gym counter"
  }
  ```
- **Backend Logic:** Creates Payment `status: "success"` and activates subscription immediately.
- **Frontend Screen:** "Record Counter Payment" sheet on `OwnerPaymentsPage.tsx`.

### 40. `GET /api/v1/payments/me`
- **Purpose:** Member views all their transaction receipts.
- **Access:** Member only.
- **Data Out (200):** Array of `PaymentRead` objects.
- **Frontend Screen:** `MemberHistoryPage.tsx`.

### 41. `GET /api/v1/payments`
- **Purpose:** Full financial ledger of all gym transactions.
- **Access:** Owner only.
- **Data Out (200):** Array of all payments across all members.
- **Frontend Screen:** `OwnerPaymentsPage.tsx`.

---

## Group 7 — Coupons & Offers (`/api/v1/coupons`)

### 42. `GET /api/v1/coupons`
- **Purpose:** List all promotional coupons with usage metrics.
- **Access:** Owner only.
- **Data Out (200):** Array of `CouponRead` objects showing `current_uses / max_uses`.
- **Frontend Screen:** `OwnerCouponsPage.tsx`.

### 43. `POST /api/v1/coupons`
- **Purpose:** Owner creates a new discount code.
- **Access:** Owner only.
- **Data In (Body):**
  ```json
  {
    "code": "DIWALI20",
    "name": "Diwali Festival Offer",
    "description": "20% off capped at ₹300",
    "discount_type": "percentage",
    "discount_value": 20,
    "min_plan_price_paise": 100000,
    "max_discount_paise": 30000,
    "max_uses": 500,
    "per_user_limit": 1,
    "valid_until": "2026-11-15T23:59:59Z"
  }
  ```
- **Frontend Component:** "Create Coupon" modal on `OwnerCouponsPage.tsx`.

### 44. `GET /api/v1/coupons/validate/{code}?plan_id={plan_id}`
- **Purpose:** Instant discount preview in checkout sheet before payment.
- **Access:** Authenticated (Member).
- **Data Out (200):**
  ```json
  {
    "valid": true,
    "code": "DIWALI20",
    "discount_type": "percentage",
    "discount_value": 20,
    "discount_paise": 30000,
    "original_paise": 150000,
    "final_paise": 120000,
    "description": "20% off capped at ₹300"
  }
  ```
- **Frontend Component:** Real-time feedback in `CheckoutDrawer.tsx` when the user taps "Apply Coupon".

### 45. `GET /api/v1/coupons/{coupon_id}`
- **Purpose:** Inspect single coupon details.
- **Access:** Owner only.

### 46. `PATCH /api/v1/coupons/{coupon_id}`
- **Purpose:** Edit coupon dates or max usage limits.
- **Access:** Owner only.

### 47. `PATCH /api/v1/coupons/{coupon_id}/deactivate`
- **Purpose:** Kill a promotional campaign immediately.
- **Access:** Owner only.

---

## Group 8 — Referrals & Growth (`/api/v1/referrals`)

### 48. `GET /api/v1/referrals/me`
- **Purpose:** Member's referral dashboard.
- **Access:** Member only.
- **Data Out (200):**
  ```json
  {
    "my_referral_code": "ARJUN001",
    "shareable_link": "https://fitcore.in/join?ref=ARJUN001",
    "referrer_reward": { "type": "loyalty_points", "value": 500 },
    "referee_reward": { "type": "flat_paise", "value": 20000 },
    "stats": { "total_referrals": 6, "successful_joins": 4, "total_points_earned": 2000 },
    "referred_members": [
      { "user_id": "...", "full_name": "Ravi Kumar", "joined_on": "2026-09-02T10:00:00Z", "has_purchased": true, "reward_issued": true }
    ]
  }
  ```
- **Frontend Screen:** `MemberReferralPage.tsx` ("Invite Friends & Earn Points"). Has 1-click **"Share on WhatsApp"** and **"Copy Link"** buttons.

### 49. `GET /api/v1/referrals`
- **Purpose:** Owner views gym-wide referral viral coefficient and conversion metrics.
- **Access:** Owner only.
- **Frontend Screen:** `OwnerDashboardPage.tsx` referral analytics tab.

---

## Group 9 — Dashboards & Analytics (`/api/v1/dashboard`)

### 50. `GET /api/v1/dashboard/owner`
- **Purpose:** Single-call aggregation of all primary business KPIs.
- **Access:** Owner only.
- **Data Out (200):**
  ```json
  {
    "stats": {
      "total_members": 245,
      "active_subscriptions": 189,
      "expired_subscriptions": 56,
      "checkins_today": 43,
      "revenue_this_month_paise": 28500000, // ₹2,85,000
      "revenue_last_month_paise": 24000000,
      "revenue_change_percent": 18.75
    },
    "expiring_soon_count": 12,
    "recent_payments": [
      { "member_name": "Arjun Patil", "plan_name": "Gold Monthly", "amount_paise": 135000, "created_at": "2026-09-09T08:30:00Z" }
    ],
    "popular_plan": { "plan_name": "Gold Monthly", "active_count": 98 }
  }
  ```
- **Frontend Screen:** `OwnerDashboardPage.tsx` (`StatsCard.tsx` + `RevenueChart.tsx`).

### 51. `GET /api/v1/dashboard/trainer`
- **Purpose:** Operational metrics for trainers on shift.
- **Access:** Trainer, Owner.
- **Data Out (200):**
  ```json
  {
    "checkins_today": 23,
    "expiring_soon_count": 5,
    "last_checkin": { "member_name": "Arjun Patil", "time": "2026-09-09T08:15:00Z" }
  }
  ```
- **Frontend Screen:** `TrainerDashboardPage.tsx`.
