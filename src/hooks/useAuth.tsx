import { createContext, useContext, useEffect, useState } from "react";
import { pb } from "@/lib/pocketbase";
import { MEMBER_COLORS, AVATAR_EMOJIS } from "@/lib/constants";

interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  color: string;
  avatar_emoji: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsConfirm: boolean }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toUser(model: any): AuthUser | null {
  if (!model) return null;
  return {
    id: model.id,
    email: model.email,
    display_name: model.display_name ?? model.email?.split("@")[0] ?? "Mitglied",
    color: model.color ?? MEMBER_COLORS[0],
    avatar_emoji: model.avatar_emoji ?? AVATAR_EMOJIS[0],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => toUser(pb.authStore.model));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vorhandene Session prüfen/erneuern
    if (pb.authStore.isValid) {
      pb.collection("users")
        .authRefresh()
        .catch(() => pb.authStore.clear())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    // Auf Änderungen am AuthStore reagieren (Login/Logout, auch in anderen Tabs)
    const unsub = pb.authStore.onChange(() => {
      setUser(toUser(pb.authStore.model));
    });
    return () => unsub();
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    await pb.collection("users").authWithPassword(email, password);
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const color = MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)];
    const avatar_emoji = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
    await pb.collection("users").create({
      email,
      password,
      passwordConfirm: password,
      display_name: displayName,
      color,
      avatar_emoji,
    });
    // Direkt anmelden (keine E-Mail-Bestätigung nötig)
    await pb.collection("users").authWithPassword(email, password);
    return { needsConfirm: false };
  };

  const signOut = () => {
    pb.authStore.clear();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithPassword, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von AuthProvider verwendet werden");
  return ctx;
}
