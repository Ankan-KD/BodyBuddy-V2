import { createClient } from "@supabase/supabase-js";

// Set these in your .env.local (see .env.example). The full schema to run
// in your Supabase project's SQL editor lives in supabase/schema.sql.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// A single browser client shared across the app. Session tokens are kept
// in the browser's own auth storage (managed entirely by supabase-js) so
// that sessions persist across reloads and sync automatically — this is
// separate from application data, which now lives entirely in Postgres.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Returns an `Authorization: Bearer <token>` header for the current signed-in
 * user (or an empty object if signed out / not configured). Every API route
 * that must know *which* user is calling it (not just trust the request)
 * needs this attached — otherwise the server can't tell a real user from an
 * anonymous caller. Used for the AI routes (food-chat, food-lookup,
 * health-report, nutrition-coach) and the store checkout routes.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
