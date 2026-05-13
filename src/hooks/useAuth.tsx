import { useEffect, useState, createContext, useContext, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RolePanitia = Database["public"]["Enums"]["role_panitia"];

const ADMIN_ROLES: RolePanitia[] = [
  "super_admin",
  "admin_pendaftaran",
  "admin_keuangan",
  "admin_kupon",
  "admin_hewan",
];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  role: RolePanitia | null;
  panitiaId: string | null;
  panitiaName: string | null;
  isAdmin: () => boolean;
  hasRole: (roles: RolePanitia[]) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  role: null,
  panitiaId: null,
  panitiaName: null,
  isAdmin: () => false,
  hasRole: () => false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<RolePanitia | null>(null);
  const [panitiaId, setPanitiaId] = useState<string | null>(null);
  const [panitiaName, setPanitiaName] = useState<string | null>(null);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("panitia")
      .select("id, role, nama")
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      setRole(data.role);
      setPanitiaId(data.id);
      setPanitiaName(data.nama);
    } else {
      setRole(null);
      setPanitiaId(null);
      setPanitiaName(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user) {
          setTimeout(() => fetchRole(session.user.id), 0);
        } else {
          setRole(null);
          setPanitiaId(null);
          setPanitiaName(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchRole(session.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAdmin = () => role !== null && ADMIN_ROLES.includes(role);
  const hasRole = (roles: RolePanitia[]) => role !== null && roles.includes(role);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, role, panitiaId, panitiaName, isAdmin, hasRole, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
