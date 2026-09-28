# SnapSeat

[![CI](https://github.com/Aash55/SnapSeat/actions/workflows/ci.yml/badge.svg)](https://github.com/Aash55/SnapSeat/actions/workflows/ci.yml)

Event ticketing with **atomic seat locking** and **idempotent payments**. Customers pick up to 4 seats,
hold them for 5 minutes, and pay. Two people can never end up with the same seat, and a retried
payment can never charge twice. Organizers create events with priced seat categories and track
bookings, revenue and occupancy.

**Stack:** Node 22 · Express 5 · PostgreSQL · Sequelize · React 19 · Vite · Tailwind 4

- **Live app:** https://snapseat-web.onrender.com
- **Demo login:** `user1@test.com` / `password123` (customer) · `organizer@snapseat.com` / `password123` (organizer portal at `/organizer/login`)
- **Note:** free Render plan, so the first request after a while takes ~30–60 s to wake up.

## How the booking core works

```
 pick seats ──► POST /holds ──────────► seats: free → held      (row locks, 5-min TTL)
                                          │
 pay ────────► POST /payments ──► 1. reserve: PENDING payment row   (short transaction)
               Idempotency-Key       2. charge gateway               (no locks held)
                                     3. apply signed gateway event   (one transaction)
                                          ├─ hold alive  → SUCCESS, booking, seats booked
                                          └─ hold expired → REFUND_PENDING, seats untouched
 expiry sweeper (every 15s) ─────────► DELETE expired holds … FOR UPDATE SKIP LOCKED,
                                       free seats only WHERE status = 'held'
```

The guarantees live in the database, not only in application code:

| Rule | Enforced by |
|---|---|
| A seat is held by at most one hold | `UNIQUE (holds.seat_id)` + `SELECT … FOR UPDATE` on seats |
| One active hold per customer (double-click safe) | `pg_advisory_xact_lock(user)` |
| A hold is charged at most once | partial unique index `payments(hold_group_id) WHERE status IN ('PENDING','SUCCESS')` |
| A retried request never creates a second charge | `UNIQUE (payments.idempotency_key)` + replay of the stored result |
| A hold becomes at most one booking | `UNIQUE (bookings.hold_group_id)` |
| A booked seat is never released by the sweeper | sweeper frees only `status = 'held'`; skips holds a payment is deciding on |
| No deadlocks | every transaction locks in the same order: payments → holds → seats |

A declined payment can be retried **with the same idempotency key**: the server re-attempts the same
payment row (`attempts` goes to 2) instead of creating a new one. Webhooks are HMAC-SHA256 signed,
timestamped (5-minute window) and compared in constant time; duplicate deliveries are ignored.

## Run locally (Windows: use Git Bash)

Needs Node 20+ and PostgreSQL.

```bash
# 1. API
cd server
cp .env.example .env        # then fill DB_PASSWORD, JWT_SECRET, WEBHOOK_SECRET
npm install
createdb snapseat           # or create it in pgAdmin
npm run migrate
npm run seed                # demo users + 5 upcoming events
npm run dev                 # http://localhost:5000/api/health

# 2. Web app (second terminal)
cd client
npm install
npm run dev                 # http://localhost:3000
```

Demo accounts (password `password123`): `user1@test.com`, `user2@test.com` (customers),
`organizer@snapseat.com` (organizer portal at `/organizer/login`).

In development the checkout page shows a **Test mode: simulate failure** switch. It sends an
`X-Simulate-Payment: decline` header, which the API honours only outside production. The switch is
removed from production builds entirely.

## Tests

```bash
cd server
createdb snapseat_test
npm test
```

27 tests run against a real PostgreSQL database, because row locks, `SKIP LOCKED` and partial
indexes only exist there. They include: 10 users racing for one seat, the same payment sent 5 times
at once, two keys for one hold, retry-after-decline, a payment landing after the hold expired, the
sweeper racing a payment (forced interleaving plus a 25-payment stress run), signed-webhook checks,
and an invariant check (no booked seat without a booking, no hold charged twice, …).

GitHub Actions runs these tests against a Postgres 16 service container on every push, plus the
client lint and production build (`.github/workflows/ci.yml`).

## Deploy (Render + Neon)

1. **Database:** create a free project on [neon.tech](https://neon.tech) and copy its connection string.
2. **Render:** New → Blueprint → pick this repo. `render.yaml` creates `snapseat-api` and `snapseat-web`.
3. Fill the variables Render asks for:
   - `snapseat-api` → `DATABASE_URL` = the Neon string, `CORS_ORIGIN` = the web app URL
   - `snapseat-web` → `VITE_API_URL` = `https://<api-name>.onrender.com/api`
4. Migrations run on every API deploy. Seed demo data once from your machine:
   `DATABASE_URL="<neon string>" npm run seed` (inside `server/`).

Free Render services sleep after inactivity, so the first request after a while takes ~30–60 s.
Open the API health URL a minute before a demo.

## Project layout

```
server/
  config/        one config module (env validation, DATABASE_URL/SSL)
  services/      bookingService.js (holds, payments, sweeper), fakeGateway.js (signing)
  controllers/   thin HTTP handlers with input validation
  migrations/    schema, incl. 20260928000000-payment-integrity (payment/booking constraints)
  tests/         node:test + supertest suites
client/src/
  pages/         customer flow + organizer console
  components/    header, toasts, route guards, active-hold banner
  lib/           formatting, category colours
```
