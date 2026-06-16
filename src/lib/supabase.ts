import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  // Nicht abbrechen – App zeigt einen freundlichen Hinweis (siehe ConfigGuard).
  console.warn(
    "[Plan] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen. Bitte .env anlegen (siehe .env.example).",
  );
}

export const supabase = createClient(url ?? "http://localhost", anonKey ?? "public-anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Basis-URL des abonnierbaren .ics-Feeds (Edge Function). */
export function icsUrl(token: string): string {
  const base =
    (import.meta.env.VITE_ICS_BASE_URL as string | undefined) ??
    `${url ?? ""}/functions/v1/ics`;
  return `${base}?token=${token}`;
}
