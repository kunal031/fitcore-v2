# ⚡ FitCore v2 — Caching Strategy & Architecture Guide

> **Core Question:** Is caching necessary for FitCore v2? What techniques should be used, where, and why?

---

## 1. The Honest Truth: Is Caching Necessary?

### For Day 1 (100–500 members):
- **Not mandatory to make the app work.** FastAPI + MongoDB Atlas on local development or low volume can handle traffic without caching.

### For Production & Portfolio Quality (Product Company Standard):
- **YES, targeted caching is essential.**
- Here is why: Your MongoDB Atlas cluster is hosted in the cloud (e.g. AWS Mumbai). Every database query introduces **100ms – 400ms network latency**.
- Without caching:
  - Every time a member taps a tab, they wait 400ms.
  - On every authenticated API request, the auth middleware queries MongoDB to verify the user (`UserDocument.get(user_id)`). That means **50 out of 55 endpoints query the database twice per request**!
- With targeted caching:
  - Response times drop from **350ms ➔ 4ms** (instantaneous UI feel).
  - MongoDB Atlas connection counts and compute load drop by **70%–80%**.

---

## 2. The 3 Caching Layers

```
Layer 1: FRONTEND CACHE (Browser RAM)
   └── TanStack Query / SWR / Zustand
   └── Prevents network requests when user switches tabs.

Layer 2: BACKEND CACHE (Redis / Server RAM)
   └── Redis or in-memory LRU cache
   └── Stores plan catalog, user sessions, dashboard aggregations.

Layer 3: DATABASE CACHE (WiredTiger Engine)
   └── MongoDB compound indexes & working set in RAM.
```

---

## 3. WHERE to Cache (High-Impact Target Endpoints)

### 🎯 Target 1: User Session in Auth Middleware (`get_current_user`)
- **The Problem:** Almost every route (50+ routes) executes `user = await UserDocument.get(user_id)` to verify the user's role and `is_active` status.
- **The Technique:** **Cache-Aside with Redis or In-Memory TTL (5 minutes)**.
  - When a token arrives, check cache: `cache.get(f"user:{user_id}")`.
  - If hit ➔ return user immediately (**1ms** instead of 300ms DB roundtrip).
  - If miss ➔ query MongoDB, store in cache for 5 minutes.
  - Invalidate cache when user updates profile or gets suspended.
- **Impact:** **80% reduction in overall MongoDB read operations.**

---

### 🎯 Target 2: Fitness Plans Catalog (`GET /api/v1/plans`)
- **The Problem:** Plans change maybe once a month, but members open the store constantly. Querying MongoDB every time is pure waste.
- **The Technique:** **Read-Through Cache with Event-Based Invalidation**.
  - Cache key: `catalog:plans:active`.
  - Cache TTL: 24 hours.
  - Invalidation trigger: Whenever the Owner calls `POST /plans` or `PATCH /plans/{id}`, delete `catalog:plans:active`.
- **Impact:** Store loads in **sub-10ms** on mobile devices.

---

### 🎯 Target 3: Owner Dashboard Analytics (`GET /api/v1/dashboard/owner`)
- **The Problem:** Calculating total revenue, monthly change %, active passes, and expiring passes requires scanning multiple collections and summing transactions. Running this heavy query on every dashboard refresh will choke the database when transactions grow.
- **The Technique:** **Time-To-Live (TTL) Caching (5 to 10 minutes)**.
  - Cache key: `dashboard:owner:stats`.
  - TTL: 5 minutes.
  - Owner dashboard updates every 5 minutes instead of hammering the DB on every page reload.
- **Impact:** Heavy database aggregations are capped to once every 5 minutes.

---

### 🎯 Target 4: Frontend Client Cache (React / TanStack Query)
- **The Problem:** A member taps "Home" ➔ "Profile" ➔ "Home". Without client caching, the app shows a loading spinner every single time.
- **The Technique:** **Stale-While-Revalidate (SWR)**.
  - When the user opens the app, show the data cached in memory immediately.
  - Fetch fresh data in the background and update the UI smoothly without layout shifts.

---

## 4. 🚫 DANGER ZONES: Where Caching MUST NEVER Be Used

Never cache these endpoints. Doing so will cause severe financial or operational bugs:

| Endpoint | Why Caching is FORBIDDEN |
|---|---|
| **`POST /api/v1/checkin`** | **Must be 100% real-time and atomic.** If cached, a member could scan a QR code twice at two turnstiles simultaneously and avoid a day deduction. |
| **`POST /api/v1/payments/verify`** | **Financial transaction.** Must execute direct database writes with idempotency checks to prevent double subscriptions. |
| **`GET /api/v1/subscriptions/me`** | Day balance must always reflect the exact current state after a scan. |

---

## 5. Technology Recommendation for FitCore v2

### Option A: In-Memory Caching (Zero Extra Cost — Recommended for Now)
- **Tool:** `cachetools` (Python library).
- **How it works:** Keeps cached objects directly in FastAPI process RAM.
- **Pros:** 0 additional servers, 0 cost, sub-millisecond speed.
- **Cons:** Cache clears on server restart.

### Option B: Redis (Production Product Standard)
- **Tool:** **Upstash Redis** (Serverless, free tier provides 10,000 requests/day).
- **How it works:** Independent in-memory key-value database.
- **Pros:** Shared across multiple server instances; persists across redeployments.

---

## 6. Implementation Summary

```
┌──────────────────────────────┬───────────────────┬──────────────┬────────────────────────────┐
│ Layer                        │ Technique         │ TTL          │ Invalidation Trigger       │
├──────────────────────────────┼───────────────────┼──────────────┼────────────────────────────┤
│ 1. Auth User Session         │ Cache-Aside       │ 5 minutes    │ Profile update / suspend   │
│ 2. Fitness Plans Catalog     │ Event-Invalidated │ 24 hours     │ Plan create/edit/delete    │
│ 3. Owner Dashboard Stats     │ Time-To-Live      │ 5 minutes    │ Natural TTL expiry         │
│ 4. Client-side Navigation    │ TanStack Query    │ 2 minutes    │ User manual pull-to-refresh│
└──────────────────────────────┴───────────────────┴──────────────┴────────────────────────────┘
```
