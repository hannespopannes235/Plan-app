import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pb } from "@/lib/pocketbase";

/**
 * Abonniert Realtime-Änderungen einer PocketBase-Collection und invalidiert den
 * passenden Query-Key. So sehen alle Geräte Änderungen sofort.
 *
 * Die API-Rules sorgen dafür, dass man nur Events zu eigenen Haushalten erhält.
 */
export function useRealtimeTable(
  collection: string,
  householdId: string | null | undefined,
  queryKey: (string | null | undefined)[],
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!householdId) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    pb.collection(collection)
      .subscribe("*", () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .then((unsub) => {
        if (cancelled) unsub();
        else unsubscribe = unsub;
      })
      .catch(() => {
        /* Verbindung evtl. nicht verfügbar – TanStack Query refetcht ohnehin */
      });

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, householdId, queryClient, JSON.stringify(queryKey)]);
}
