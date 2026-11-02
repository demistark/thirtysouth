import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "host" | "schedule_manager" | "trip_guest" | "friend_afar" | "honorary_guest";

interface AuthState {
  session: Session | null;
  loading: boolean;
  roles: Role[];
  isHost: boolean;
  isFriend: boolean;
  initial: string;
  displayName: string;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queryClient.invalidateQueries({ queryKey: ["roles"] });
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id;
  // Roles always come from the database; never cached in storage.
  const rolesQ = useQuery({
    queryKey: ["roles", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as Role);
    },
  });
  const roles = userId ? (rolesQ.data ?? []) : [];
  const profileQ = useQuery({
    queryKey: ["my-profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_profile");
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  const displayName = (userId ? profileQ.data?.display_name : null) || session?.user.email?.split("@")[0] || "";

  const isHost = roles.includes("host");
  const isFriend = isHost || roles.includes("trip_guest");
  const initial = (session?.user.email ?? "?").charAt(0).toUpperCase();

  const signOut = async () => {
    await queryClient.cancelQueries();
    await supabase.auth.signOut();
    queryClient.removeQueries({ queryKey: ["roles"] });
    queryClient.removeQueries({ queryKey: ["admin"] });
    queryClient.removeQueries({ queryKey: ["my-profile"] });
  };

  // Friends afar: end the session when the code was disabled, the master switch
  // is off, or the role changed. Regeneration also revokes refresh tokens server-side.
  const rolesKey = roles.join(",");
  useEffect(() => {
    if (!userId || rolesQ.isLoading || !rolesKey.includes("friend_afar")) return;
    supabase.rpc("afar_session_valid").then(({ data }) => {
      if (data === false) void signOut();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, rolesQ.isLoading, rolesKey]);

  return (
    <AuthContext.Provider
      value={{
        session,
        loading: loading || (!!userId && rolesQ.isLoading),
        roles,
        isHost,
        isFriend,
        initial,
        displayName,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
