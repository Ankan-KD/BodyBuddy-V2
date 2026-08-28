import { createClient, type User } from "@supabase/supabase-js";

// ════════════════════════════════════════════════════════════════════════
// Server-only Supabase client (service role key).
// NEVER import this file from a "use client" component — the service role
// key bypasses Row Level Security entirely. It must only be used inside
// API routes (src/app/api/**/route.ts), which run on the server.
// ════════════════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const isSupabaseAdminConfigured = Boolean(supabaseUrl && serviceRoleKey);

export const supabaseAdmin = isSupabaseAdminConfigured
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

/**
 * Validates a Supabase access token (sent by the client as
 * `Authorization: Bearer <token>`) and returns the authenticated user, or
 * null if the token is missing/invalid. Used by every store checkout API
 * route so pricing and order writes are never trusted from the client.
 */
export async function getUserFromRequest(request: Request): Promise<User | null> {
  if (!supabaseAdmin) return null;
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
