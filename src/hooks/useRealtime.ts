import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Abonniert Realtime-Änderungen für eine Tabelle innerhalb des aktiven
 * Haushalts und invalidiert den passenden Query-Key. So sehen alle Geräte
 * Änderungen sofort.
 */
export function useRealtimeTable(
  table: string,
  householdId: string | null | undefined,
  queryKey: (string | null | undefined)[],
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel(`${table}-${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, householdId, queryClient, JSON.stringify(queryKey)]);
}
