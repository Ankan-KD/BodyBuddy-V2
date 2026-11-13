import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ════════════════════════════════════════════════════════════════════════
// BB Store — Expire abandoned checkouts (scheduler-friendly fallback)
// Cancels orders still "pending payment" after EXPIRY_MINUTES so their
// held stock is released (via the restore_inventory_on_cancel trigger).
//
// Primary mechanism is pg_cron (see 013_expire_pending_orders.sql). Use
// this endpoint if pg_cron isn't available: point any scheduler (Vercel
// Cron, GitHub Actions, cron-job.org, a server crontab) at it every ~5 min
// with header:  Authorization: Bearer <CRON_SECRET>
// Add CRON_SECRET to .env.local.
// ════════════════════════════════════════════════════════════════════════

const EXPIRY_MINUTES = 15;

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ ok: false, error: "Not configured." }, { status: 503 });
  }

  const { data, error } = await supabaseAdmin.rpc("expire_stale_pending_orders", {
    p_minutes: EXPIRY_MINUTES,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, expired: data });
}

export const GET = handle;
export const POST = handle;