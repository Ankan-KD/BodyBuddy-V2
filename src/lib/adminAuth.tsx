"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

interface AdminAuthContextValue {
  isAdmin: boolean;
  adminLoading: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  isAdmin: false,
  adminLoading: true,
});

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !supabase) {
      setIsAdmin(false);
      setAdminLoading(false);
      return;
    }

    // Backend-backed admin check — reads from user_settings, not just frontend state
    supabase
      .from("user_settings")
      .select("is_store_admin")
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setIsAdmin(false);
        } else {
          setIsAdmin(data.is_store_admin === true);
        }
        setAdminLoading(false);
      });
  }, [user, authLoading]);

  // Re-check admin status if user changes
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setAdminLoading(false);
    }
  }, [user]);

  return (
    <AdminAuthContext.Provider value={{ isAdmin, adminLoading }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
