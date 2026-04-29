import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  homeSet: boolean | null; // null = unknown / not yet loaded
  refreshHome: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  homeSet: null,
  refreshHome: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [homeSet, setHomeSet] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshHome = useCallback(async () => {
    if (!session?.user?.id) { setHomeSet(null); return; }
    const { data } = await supabase
      .from("profiles")
      .select("home_set")
      .eq("id", session.user.id)
      .single();
    setHomeSet(((data as any)?.home_set as boolean) ?? false);
  }, [session?.user?.id]);

  useEffect(() => { refreshHome(); }, [refreshHome]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setHomeSet(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, homeSet, refreshHome, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
