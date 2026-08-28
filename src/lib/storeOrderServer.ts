import { supabaseAdmin } from "./supabaseAdmin";

// ════════════════════════════════════════════════════════════════════════
// Server-only helpers shared by the checkout API routes. Never import
// from a "use client" component.
// ════════════════════════════════════════════════════════════════════════

/**
 * Cancels an order and records why. Relies on the existing
 * `restore_inventory_on_cancel` DB trigger (006_inventory_automation.sql)
 * to put stock back automatically on the placed→cancelled transition —
 * no manual stock math needed here.
 */
export async function cancelOrderServer(orderId: string, reason: string): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin
    .from("store_orders")
    .update({
      status: "cancelled",
      payment_status: "failed",
      payment_error: reason.slice(0, 500),
    })
    .eq("id", orderId)
    // Never re-cancel (and re-fire the restore trigger on) an already
    // cancelled order — keeps this idempotent.
    .neq("status", "cancelled");
}
