import PocketBase from "pocketbase";

// Standard: gleiche Herkunft wie die ausgelieferte App (PocketBase serviert die
// PWA selbst). Für lokale Entwicklung gegen ein separates PocketBase kann
// VITE_PB_URL gesetzt werden (z. B. http://127.0.0.1:8090).
const baseUrl =
  (import.meta.env.VITE_PB_URL as string | undefined)?.trim() ||
  (typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8090");

export const pb = new PocketBase(baseUrl);

// Wichtig mit TanStack Query: PocketBase bricht sonst „doppelte" parallele
// Requests automatisch ab, was zu Fehlern führen würde.
pb.autoCancellation(false);

/** Aktuell angemeldeter Nutzer (oder null). */
export function currentUserId(): string | null {
  return pb.authStore.model?.id ?? null;
}

/** Basis-URL des abonnierbaren .ics-Feeds (Custom-Route in pb_hooks). */
export function icsUrl(token: string): string {
  return `${pb.baseUrl.replace(/\/$/, "")}/ics/${token}`;
}
