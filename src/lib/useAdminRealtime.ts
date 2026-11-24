// ════════════════════════════════════════════════════════════════════════
// useAdminRealtime — Supabase Realtime hook for the admin portal
// Delivers raw INSERT / UPDATE / DELETE row events so pages can patch
// their local state in-place. Zero page reloads.
// ════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export interface AdminRealtimeOptions<T = Record<string, unknown>> {
  table: string;
  /** Optional Supabase row-level filter, e.g. "id=eq.abc123" */
  filter?: string;
  onInsert?: (row: T) => void;
  onUpdate?: (row: T) => void;
  onDelete?: (row: T) => void;
}

export interface AdminRealtimeResult {
  connected: boolean;
}

export function useAdminRealtime<T = Record<string, unknown>>({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
}: AdminRealtimeOptions<T>): AdminRealtimeResult {
  const [connected, setConnected] = useState(false);

  // Stable refs — the subscription closure captures these so stale
  // closures never call the wrong version of a handler.
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  useEffect(() => { onInsertRef.current = onInsert; }, [onInsert]);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);

  useEffect(() => {
    if (!supabase) return;

    // Build the postgres_changes config object
    const pgConfig: Record<string, string> = {
      event: "*",
      schema: "public",
      table,
    };
    if (filter) pgConfig.filter = filter;

    // IMPORTANT: .on() MUST be called before .subscribe().
    // We build the full chain in one expression so there is no
    // possibility of calling .on() on an already-subscribed channel.
    const channel = supabase
      .channel(`admin-rt-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        // Cast needed because supabase-js types differ across minor versions
        "postgres_changes" as any,
        pgConfig,
        (payload: any) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          if (eventType === "INSERT" && onInsertRef.current) {
            onInsertRef.current(newRow as T);
          }
          if (eventType === "UPDATE" && onUpdateRef.current) {
            onUpdateRef.current(newRow as T);
          }
          if (eventType === "DELETE" && onDeleteRef.current) {
            onDeleteRef.current(oldRow as T);
          }
        }
      )
      .subscribe((status: string) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase!.removeChannel(channel);
      setConnected(false);
    };
    // Re-subscribe only if table or filter changes — handlers are
    // accessed via stable refs so they don't need to be in the dep array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter]);

  return { connected };
}
