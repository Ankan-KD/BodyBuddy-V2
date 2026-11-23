-- ════════════════════════════════════════════════════════════════════════
-- BB Store — Coupon / Offer support on orders
-- Adds the columns to store_orders that capture which coupon was applied
-- and how much it saved. Also adds a safe atomic increment function for
-- offer used_count so concurrent orders don't race.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. New columns on store_orders ───────────────────────────────────────

ALTER TABLE store_orders
  ADD COLUMN IF NOT EXISTS offer_id          uuid    REFERENCES store_offers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code       text,
  ADD COLUMN IF NOT EXISTS coupon_discount_paise bigint NOT NULL DEFAULT 0;

-- Index so the admin can filter orders by coupon / offer easily
CREATE INDEX IF NOT EXISTS idx_store_orders_offer_id    ON store_orders(offer_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_coupon_code ON store_orders(coupon_code);

-- ── 2. Atomic used_count increment ───────────────────────────────────────
-- Called once per successfully-created order that used a coupon.
-- Uses an UPDATE rather than SELECT + UPDATE to avoid race conditions.

CREATE OR REPLACE FUNCTION increment_offer_used_count(p_offer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE store_offers
  SET    used_count  = used_count + 1,
         updated_at  = now()
  WHERE  id = p_offer_id;
END;
$$;

-- Allow the service-role key (used by the API route) to call it
GRANT EXECUTE ON FUNCTION increment_offer_used_count(uuid) TO service_role;

-- ── 3. Public read access to store_offers for the validate-coupon route ──
-- (The API routes use supabaseAdmin / service-role, so they bypass RLS.
--  The client-side ActiveOffersBanner uses the anon key — ensure it can
--  read active offers.)

-- Only expose active, in-date, code-carrying offers to anonymous readers.
-- Sensitive fields like used_count / max_uses can stay masked if desired,
-- but showing them helps customers know when a code is about to run out.
DROP POLICY IF EXISTS "anon can read active offers" ON store_offers;
CREATE POLICY "anon can read active offers"
  ON store_offers FOR SELECT
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >= now())
  );
