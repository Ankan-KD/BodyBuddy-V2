# BodyBuddy + BB Store

BodyBuddy is a goal-based nutrition and fitness companion app with an integrated supplement and nutrition e-commerce store built in. Users pick a goal (muscle gain, fat loss, or maintenance), track daily meals against custom macro targets, monitor weight trends, and receive AI-powered coaching — all from a single app. The same login session gives them seamless access to **BB Store**, a full-featured storefront for sports nutrition products, with cart, wishlist, Razorpay checkout, order tracking, and a complete admin panel.

---

## ✨ Features

### BB Health — Nutrition & Fitness Tracking

- 🔐 **Auth** — email/password with OTP-secured password management, and email magic-link sign-in via Supabase Auth
- 🍽️ **Daily food checklist** — log meals against a personalised food list; mark items complete and watch macros update in real time
- ⚖️ **Weight tracking & goals** — log daily weights, set a goal weight, and visualise your trend curve
- 📊 **Dashboard** — daily nutrition summary (calories, protein, carbs, fat, water), streak counter, and progress rings
- 📅 **History** — scroll back through any past day's log and macro totals
- 🔥 **Streaks & milestones** — goal-aware achievement badges that celebrate consistency
- 🧠 **AI Nutrition Coach** — Google Gemini-powered chat that answers "what can I eat right now?" and gives actionable logging advice
- ⚙️ **Settings** — goal mode, calorie/macro targets, goal weight, units (metric/imperial), theme, display name
- ☁️ **Cloud sync** — all data stored in Supabase Postgres, available across devices

### BB Store — E-Commerce Module

- 🛍️ **Browse & search** — product listing with filters, full-text search, category and goal-tag navigation
- 🗂️ **Categories & goals** — hierarchical categories (e.g. Protein → Whey Protein) and health-goal tags (muscle-gain, weight-loss, etc.)
- 🛒 **Cart** — persistent per-user cart with variant selection (size, flavour), quantity controls, and live price totals
- ❤️ **Wishlist** — heart-toggle on any product card saves it to a dedicated wishlist page; works for guests (localStorage) and signed-in users (Supabase-persisted), with automatic merge on login
- 💳 **Checkout via Razorpay** — full Razorpay payment flow (UPI, card, netbanking, wallet, EMI); orders are created server-side with webhook verification
- 📦 **Multiple saved delivery addresses** — store any number of addresses with custom labels (Home, Work, etc.) and a default flag; prefilled automatically at checkout
- 📋 **Order history & tracking** — per-order status timeline (placed → confirmed → processing → shipped → delivered) with receipt PDF download
- 🔧 **Admin panel** (`/admin`) — catalog management, order management (status updates, receipt & shipping-label generation), customers, inventory, offers/discounts, categories, store settings, and a summary dashboard

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, server components + client components) |
| Language | TypeScript 5.7 |
| Styling | Tailwind CSS 3.4 |
| Database / Auth | Supabase (Postgres + Auth + RLS) via `@supabase/supabase-js` 2.47 |
| Payments | Razorpay (server-side order creation + webhook verification) |
| Email | Resend 4.8 (6-digit OTP delivery) |
| AI | Google Gemini (nutrition coach; configurable model + optional search grounding) |
| PDF generation | jsPDF 2.5 + jspdf-autotable 3.8 (receipts, admin internal copy, shipping labels) |
| Icons | Lucide React 0.469 |
| CSV parsing | PapaParse 5.7 (admin bulk-import tooling) |

---

## 📁 Project Structure

```
BodyBuddy/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Root redirect (→ /dashboard or /landing)
│   │   ├── layout.tsx            # Root layout (fonts, providers)
│   │   ├── dashboard/            # BB Health: daily nutrition dashboard
│   │   ├── foods/                # Food checklist & meal logging
│   │   ├── weight/               # Weight log & trend chart
│   │   ├── history/              # Past-day log viewer
│   │   ├── combos/               # Saved meal combos
│   │   ├── settings/             # User settings
│   │   ├── onboarding/           # First-run goal setup
│   │   ├── login/                # Auth page
│   │   ├── landing/              # Public landing page
│   │   ├── store/                # BB Store (customer-facing)
│   │   │   ├── page.tsx          # Store home / featured
│   │   │   ├── products/         # Product listing + [id] detail
│   │   │   ├── categories/       # Category browser + [id] listing
│   │   │   ├── goals/            # Goal-tag filtered listing
│   │   │   ├── search/           # Search results
│   │   │   ├── deals/            # Active offers/deals
│   │   │   ├── cart/             # Cart page
│   │   │   ├── wishlist/         # Wishlist page
│   │   │   ├── checkout/         # Checkout + Razorpay payment
│   │   │   ├── orders/           # Order history + [id] detail
│   │   │   └── profile/          # Store profile + saved addresses
│   │   ├── admin/                # BB Store admin panel
│   │   │   ├── dashboard/        # Admin summary dashboard
│   │   │   ├── orders/           # Order list + [id] detail (status mgmt, PDFs)
│   │   │   ├── products/         # Product CRUD
│   │   │   ├── catalog/          # Product catalogue import/management
│   │   │   ├── categories/       # Category management
│   │   │   ├── customers/        # Customer list
│   │   │   ├── inventory/        # Stock levels
│   │   │   ├── offers/           # Promotions & discount codes
│   │   │   ├── settings/         # Store settings (name, return address, etc.)
│   │   │   └── login/            # Admin authentication
│   │   └── api/                  # Next.js API routes
│   │       ├── food-chat/        # Gemini AI chat endpoint
│   │       ├── food-lookup/      # Gemini food lookup
│   │       ├── nutrition-coach/  # AI coach endpoint
│   │       ├── health-report/    # Weekly health report
│   │       ├── otp/              # OTP issue / verify
│   │       ├── password/         # Password reset flow
│   │       └── store/
│   │           └── checkout/     # Razorpay order create / verify / fail
│   ├── components/               # Shared UI components
│   └── lib/                      # Business logic, types, API helpers, PDF generators
│       ├── orderTypes.ts         # StoreOrder / StoreOrderItem / DeliveryAddress
│       ├── storeTypes.ts         # Product / Category / Variant + formatPriceINR
│       ├── offerTypes.ts         # StoreOffer / StoreSettings
│       ├── wishlistContext.tsx    # Wishlist state (guest + signed-in, auto-merge)
│       ├── deliveryProfileApi.ts # Saved addresses CRUD
│       ├── receiptPdf.ts         # Customer receipt PDF
│       ├── adminReceiptPdf.ts    # Admin internal-copy receipt PDF
│       ├── shippingLabelPdf.ts   # Shipping label PDF (fulfillment only)
│       └── ...
├── supabase/                     # SQL migrations (run in order — see below)
├── scripts/                      # Utility scripts (e.g. catalogue merge helper)
├── Dockerfile                    # Multi-stage production Docker build
├── docker-compose.yml            # Compose file (Next.js app only; Supabase is external)
├── .env.docker.example           # Template for Docker/production env vars
└── tailwind.config.ts
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 22** (the Dockerfile uses `node:22-alpine`; any Node 22.x release works locally)
- A [Supabase](https://supabase.com) project (free tier is fine for development)
- Razorpay test-mode keys (required only for the BB Store checkout flow)
- A [Resend](https://resend.com) API key (required only for password OTP emails)
- A Google Gemini API key (optional; BB Health works without it)

### Install dependencies

```bash
npm install
```

### Environment variables

Create `.env.local` in the project root (or copy `.env.docker.example` → `.env.local` as a starting template):

```env
# ── Supabase — Authentication & Database ─────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co   # Required
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>                     # Required
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>                  # Required (server-side only)

# ── Google Gemini — AI Nutrition Coach ───────────────────────────────────
GEMINI_API_KEY=                          # Optional; coach is disabled if unset
GEMINI_MODEL=gemini-2.0-flash-lite       # Optional; defaults to this value
GEMINI_ENABLE_SEARCH_GROUNDING=false     # Optional; set true only if your billing allows it

# ── Razorpay — BB Store Checkout ─────────────────────────────────────────
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_…  # Required for checkout; use test-mode keys in dev
RAZORPAY_KEY_SECRET=                     # Required (server-side only)
RAZORPAY_WEBHOOK_SECRET=                 # Required once you configure a webhook in Razorpay Dashboard

# ── Resend — 6-digit email OTP (password change / forgot password) ────────
RESEND_API_KEY=re_…                      # Required for password management; optional otherwise
```

Variable reference:

| Variable | Side | Required | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | ✅ | Supabase anon (public) JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | ✅ | Supabase service-role key — never expose to the browser |
| `GEMINI_API_KEY` | Server only | Optional | Google Gemini API key for the AI coach |
| `GEMINI_MODEL` | Server only | Optional | Gemini model string (default: `gemini-2.0-flash-lite`) |
| `GEMINI_ENABLE_SEARCH_GROUNDING` | Server only | Optional | Enable Google Search grounding (`true`/`false`); requires billing |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Client + Server | ✅ for checkout | Razorpay publishable key (baked into client bundle at build time) |
| `RAZORPAY_KEY_SECRET` | Server only | ✅ for checkout | Razorpay secret key |
| `RAZORPAY_WEBHOOK_SECRET` | Server only | ✅ for webhooks | Webhook signature secret from Razorpay Dashboard |
| `RESEND_API_KEY` | Server only | Optional | Resend API key for OTP email delivery |

### Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 🗄️ Database Setup

All migrations live in `supabase/` and must be run **in order** via the Supabase SQL editor ([Dashboard → SQL Editor](https://supabase.com/dashboard/project/_/sql/new)). Every numbered file is safe to re-run (idempotent — uses `IF NOT EXISTS` / `OR REPLACE` / `ON CONFLICT` throughout).

> ⚠️ **Do not run `README_do_not_run.sql`** — this is a plain-SQL schema diagram used for documentation and code-generation tooling only. It references a simplified `users` table that conflicts with Supabase Auth's `auth.users`. Running it will break your schema.

| File | What it adds |
|---|---|
| `001_core_schema.sql` | Core BB Health tables: `user_settings`, `foods`, `daily_logs`, `weight_logs`, `food_combos` and all RLS policies for authenticated users |
| `002_store_schema.sql` | BB Store product catalogue: `store_categories`, `store_brands`, `store_products`, `store_product_variants`, and read policies |
| `003_store_admin.sql` | Admin foundation: `is_store_admin` flag on `user_settings`, `admin_audit_log` table, and admin-write RLS policies |
| `004_store_cart.sql` | Shopping cart: `store_cart_items` table with RLS (users see only their own cart) |
| `005_store_orders.sql` | Orders: `store_orders` + `store_order_items` tables, order-number sequence, and per-user RLS |
| `006_inventory_automation.sql` | Inventory triggers: automatically deducts `stock_quantity` on order placement; flips variant to `out_of_stock` when stock hits 0 |
| `007_phase9_features.sql` | Offers & store controls: `store_offers` table, `store_settings` key-value table, associated RLS and admin policies |
| `008_product_type_and_categories.sql` | Adds `product_type` column to `store_products` for finer-grained filtering beneath the broad category |
| `009_catalogue_redesign.sql` | Product catalogue tables: `product_catalogue`, `product_groups`, `product_types`; adds `product_group_id` and `product_type_id` FKs on `store_products`; cascade-rename triggers |
| `010_seed_groups_types_from_catalogue.sql` | Seeds the product catalogue with 332 products and 429 variants; also adds a missing unique constraint on `product_catalogue_variants` that `009` omitted |
| `011_razorpay_and_delivery.sql` | Razorpay columns on `store_orders` (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`, `payment_error`), widened `payment_method` enum, and `user_delivery_profiles` table for saved addresses |
| `012_password_otp.sql` | Documents the password-management feature's Supabase Auth configuration requirements (no new tables — see the file comments for the Auth dashboard settings you need to enable) |
| `013_password_otp_secure.sql` | Adds `password_otp_requests` table for the custom Resend-delivered OTP flow; RLS enabled with no policies (service-role access only) |
| `014_wishlist_and_addresses.sql` | Adds `store_wishlist_items` table (per-user, product-level) and `store_saved_addresses` table with label/default-flag columns; full RLS |

### Applying migrations

Paste each file's content into the Supabase SQL editor in the order shown above, then click **Run**.

---

## 🐳 Running with Docker

Docker support uses a multi-stage build (`Dockerfile`) that produces a minimal production image based on Next.js's `standalone` output. Supabase itself is **not** containerised — it remains a cloud/managed service (or a separately self-hosted instance) that the app connects to over the network.

### Quick start with Docker Compose

```bash
# 1. Copy the env template and fill in real values
cp .env.docker.example .env.local

# 2. Build and start
docker compose up --build

# 3. Open http://localhost:3000
```

The compose file reads `.env.local` as both build args (for the `NEXT_PUBLIC_*` variables, which are baked into the client bundle at build time) and as runtime environment (for server-only secrets). The host port defaults to `3000` and can be overridden with `APP_PORT=<port>` in `.env.local`.

### Plain Docker build / run

Commands are also documented at the top of `Dockerfile`:

```bash
# Build
docker build -t bodybuddy .

# Run (loads all env vars from .env.local at runtime)
docker run -p 3000:3000 --env-file .env.local bodybuddy
```

> The `NEXT_PUBLIC_*` build args must be provided to `docker build` if you use this path — they're only needed during image creation, not at runtime. The compose file handles this automatically.

---

## ☁️ Deployment (Vercel)

1. Push the repo to GitHub/GitLab/Bitbucket.
2. Import the project in the [Vercel dashboard](https://vercel.com/new).
3. Add every variable from the [Environment variables](#environment-variables) section above in **Settings → Environment Variables**.
4. After the first deployment, go to your Supabase Dashboard → **Authentication → URL Configuration** and update:
   - **Site URL** → your production domain (e.g. `https://yourapp.vercel.app`)
   - **Redirect URLs** → add `https://yourapp.vercel.app/**`
5. Redeploy if you added env vars after the initial build.

---

## 📄 License

Educational and personal use.
