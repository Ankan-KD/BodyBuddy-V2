# BodyBuddy + BB Store

BodyBuddy is a goal-based nutrition and fitness companion with a built-in
supplement store. Users pick a goal (gain, lose, maintain), track meals against
macro targets, follow their weight trend and get AI coaching. The same login
also opens **BB Store**: browse, cart, wishlist, Razorpay checkout, order
tracking, and a full admin panel.

---

## Features

### BB Health
- **Auth** — email + password, Google sign-in, and a custom 6-digit email OTP for signup verification, password change and forgot-password
- **Diet checklist** — a planned food list per day (weekday-specific or one-off foods) with live macro totals
- **Recent foods & dishes** — log things outside the Diet (pizza, biryani); a dish can credit Diet items (biryani → rice) and the credit is undone if the dish is deleted
- **Meal combos** — save a group of foods and log it in one tap
- **Weight tracking** — daily weight, goal weight, trend chart
- **Dashboard & history** — calories, protein, carbs, fat, water, streaks, past-day viewer
- **Milestones** — goal-aware achievements
- **AI coach & food lookup** — Google Gemini chat, food estimates grounded in a bundled master food database, weekly health report PDF
- **Settings** — goal mode, targets, units, theme, display name
- **Cloud sync** — Supabase Postgres with realtime updates across devices

### BB Store
- **Catalog** — categories, product groups/types, variants (size/flavour), full-text search, goal-tag browsing
- **Cart & wishlist** — per-user, persisted; the wishlist also works for guests and merges on login
- **Checkout** — Razorpay (UPI, card, netbanking, wallet, EMI); orders are created and priced server-side and confirmed by signature verification plus webhook
- **Stock safety** — stock is held atomically when an order is created, released on cancel, and unpaid orders expire after 15 minutes
- **Saved addresses** — multiple labelled addresses with a single default
- **Orders** — status timeline (placed → confirmed → processing → shipped → delivered), receipt PDF, status emails
- **Admin panel (`/admin`)** — dashboard, orders (status, receipts, shipping labels), products, master catalogue (CSV import), categories, groups & types, customers, inventory, offers, store settings

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5.7 |
| Styling | Tailwind CSS 3.4 |
| Database / Auth | Supabase (Postgres, Auth, RLS, Realtime) via `@supabase/supabase-js` |
| Payments | Razorpay, called over its REST API from server routes (no SDK) |
| Email | Gmail SMTP via `nodemailer` (OTP codes, order emails) |
| AI | Google Gemini (REST) |
| PDFs | `jspdf` + `jspdf-autotable` (receipts, admin copy, shipping labels, health report) |
| Icons | `lucide-react` |

---

## Project structure

```
BodyBuddy/
├── src/
│   ├── app/
│   │   ├── page.tsx, layout.tsx          root redirect, layout/providers
│   │   ├── landing/ login/ set-password/ onboarding/   public + first-run
│   │   ├── dashboard/ foods/ weight/ history/ combos/ settings/   BB Health
│   │   ├── store/                        BB Store (customer): products, categories, goals,
│   │   │                                 search, deals, cart, wishlist, checkout, orders, profile
│   │   ├── admin/                        BB Store admin: dashboard, orders, products, catalog,
│   │   │                                 categories, customers, inventory, offers, settings, login
│   │   └── api/
│   │       ├── food-chat, food-lookup, nutrition-coach, health-report   Gemini endpoints
│   │       ├── otp, password/{mark-set,reset}, signup/{mark-pending,complete}   OTP + password flow
│   │       └── store/{checkout,webhook,cron,admin}   create-order, verify-payment, mark-failed,
│   │                                                 Razorpay webhook, expire-orders, update-order-status
│   ├── components/                       shared UI (admin/, store/, ui/ and health components)
│   ├── data/                             master food database + product catalogue — CSV only (see src/data/README.md)
│   └── lib/                              state, API helpers, types, PDF generators, server helpers
├── supabase new/                         the database: 11 SQL files + README (see below)
├── public/fonts/                         fonts embedded in generated PDFs
├── Dockerfile, docker-compose.yml, .env.docker.example
└── tailwind.config.ts, next.config.mjs
```

---

## Getting started

### Prerequisites
- Node.js 22
- A [Supabase](https://supabase.com) project
- Razorpay test keys (store checkout only)
- A Gmail account with an [App Password](https://support.google.com/accounts/answer/185833) (OTP and order emails only)
- A Google Gemini API key (optional — BB Health works without it)

### Install and run
```bash
npm install
npm run dev        # http://localhost:3000
```

### Environment variables
Create `.env.local` in the project root.

| Variable | Side | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | yes | Service-role key; used by checkout, OTP and admin routes. Never expose it. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | client + server | for checkout | Razorpay key id (baked into the client bundle at build time) |
| `RAZORPAY_KEY_SECRET` | server only | for checkout | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | server only | for webhooks | Secret for the webhook at `/api/store/webhook` |
| `GMAIL_USER` | server only | for emails | Gmail address that sends OTP / order emails |
| `GMAIL_APP_PASSWORD` | server only | for emails | 16-character Gmail App Password |
| `CRON_SECRET` | server only | if not using `pg_cron` | Bearer token protecting `/api/store/cron/expire-orders` |
| `GEMINI_API_KEY` | server only | optional | Enables the AI coach and lookups |
| `GEMINI_MODEL` | server only | optional | Defaults to `gemini-3.5-flash-lite` |
| `GEMINI_ENABLE_SEARCH_GROUNDING` | server only | optional | `true` enables Google Search grounding (needs billing) |

---

## Database

The full database lives in **`supabase new/`** as 11 ordered SQL files. Run
them in order in the Supabase SQL editor on a fresh project; all are safe to
re-run.

| # | File | Creates |
|---|---|---|
| 001 | `001_extensions_and_shared_functions.sql` | `pgcrypto`, `set_updated_at()` |
| 002 | `002_core_health_schema.sql` | BB Health tables, CHECK constraints, dish credits, RLS, realtime |
| 003 | `003_auth_and_security.sql` | `user_security`, OTP table, signup trigger, server-only auth functions |
| 004 | `004_store_catalog_schema.sql` | Categories, brands, groups/types, products, variants, master catalogue |
| 005 | `005_store_commerce_schema.sql` | Cart, orders, Razorpay ledger, addresses, wishlist, offers, settings, audit log |
| 006 | `006_store_order_automation.sql` | Atomic stock deduction, restore on cancel, order expiry/revive, `pg_cron` |
| 007 | `007_store_security_rls.sql` | All store RLS policies |
| 008 | `008_store_views.sql` | Admin-only dashboard views |
| 009 | `009_store_seed_defaults.sql` | Starter categories, sample brand, default settings |
| 010 | `010_seed_product_catalogue.sql` | 332 catalogue products / 429 variants |
| 011 | `011_promote_store_admin.sql` | Promote your account to admin (edit the email first) |

Security in one paragraph: every table has RLS. Users only see their own
health, cart, wishlist, address and order data. Catalog data is publicly
readable (published items only) and admin-writable. Admin status, "email not
verified" and "has password" live in `user_security`, which the browser can
read but never write, so admin rights cannot be self-granted. Orders can only
be created by the server, never by the browser.

**Per-table columns, every policy, functions, triggers, views and the
stock/expiry logic are documented in [`supabase new/README.md`](<supabase new/README.md>).**

### First admin
Sign up in the app, run `011_promote_store_admin.sql` with your email, then log in at `/admin/login`.

### Razorpay webhook
In the Razorpay dashboard, point a webhook at `https://<your-domain>/api/store/webhook` and set the same secret as `RAZORPAY_WEBHOOK_SECRET`.

### Order expiry
Unpaid orders are cancelled after 15 minutes and their stock released. `006` schedules this with `pg_cron` when the extension is available (enable it under Supabase → Database → Extensions). Otherwise call `/api/store/cron/expire-orders` every ~5 minutes from any scheduler with `Authorization: Bearer <CRON_SECRET>`.

---

## Docker

Multi-stage build on Next.js standalone output. Supabase is external.

1. In `next.config.mjs`, uncomment `output: "standalone"` (keep it commented for Vercel).
2. Copy the env template and fill it in: `cp .env.docker.example .env.local`
3. Run `docker compose up --build` and open http://localhost:3000.

`NEXT_PUBLIC_*` values are build args (baked into the client bundle); the rest are runtime environment. Without compose:

```bash
docker build -t bodybuddy .
docker run -p 3000:3000 --env-file .env.local bodybuddy
```

---

## Deployment (Vercel)

1. Push the repo and import it in Vercel (leave `output: "standalone"` commented out).
2. Add every environment variable above under Settings → Environment Variables.
3. In Supabase → Authentication → URL Configuration set **Site URL** to your domain and add `https://<your-domain>/**` to **Redirect URLs**. Enable the Google provider if you use Google sign-in.
4. Create the Razorpay webhook and, if `pg_cron` isn't available, a scheduled call to the expiry endpoint.

---

## License

Educational and personal use.
