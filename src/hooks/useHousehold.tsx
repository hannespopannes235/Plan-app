import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Household, HouseholdMember, Profile } from "@/types/database";

interface HouseholdContextValue {
  households: Household[];
  activeHousehold: Household | null;
  activeId: string | null;
  setActiveId: (id: string) => void;
  members: HouseholdMember[];
  /** user_id → Profile, inkl. eigenem Profil und allen Mitgliedern. */
  profiles: Record<string, Profile>;
  myRole: string | null;
  loading: boolean;
  refetchHouseholds: () => void;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

const ACTIVE_KEY = "plan-active-household";

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeId, setActiveIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_KEY),
  );

  const householdsQuery = useQuery({
    queryKey: ["households", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Household[]> => {
      const { data, error } = await supabase
        .from("households")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const households = useMemo(() => householdsQuery.data ?? [], [householdsQuery.data]);

  // Aktive Auswahl validieren / Default setzen
  useEffect(() => {
    if (households.length === 0) return;
    const stillValid = activeId && households.some((h) => h.id === activeId);
    if (!stillValid) {
      const next = households[0].id;
      setActiveIdState(next);
      localStorage.setItem(ACTIVE_KEY, next);
    }
  }, [households, activeId]);

  const setActiveId = (id: string) => {
    setActiveIdState(id);
    localStorage.setItem(ACTIVE_KEY, id);
  };

  const membersQuery = useQuery({
    queryKey: ["members", activeId],
    enabled: !!activeId,
    queryFn: async (): Promise<{ members: HouseholdMember[]; profiles: Profile[] }> => {
      const { data: members, error } = await supabase
        .from("household_members")
        .select("*")
        .eq("household_id", activeId!);
      if (error) throw error;

      const ids = (members ?? []).map((m) => m.user_id);
      let profiles: Profile[] = [];
      if (ids.length > 0) {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("*")
          .in("id", ids);
        if (pErr) throw pErr;
        profiles = profs ?? [];
      }
      return { members: members ?? [], profiles };
    },
  });

  const members = membersQuery.data?.members ?? [];
  const profiles = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const p of membersQuery.data?.profiles ?? []) map[p.id] = p;
    return map;
  }, [membersQuery.data]);

  const activeHousehold = households.find((h) => h.id === activeId) ?? null;
  const myRole = members.find((m) => m.user_id === user?.id)?.role ?? null;

  // Realtime: Mitgliederänderungen sofort übernehmen
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`members-${activeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "household_members", filter: `household_id=eq.${activeId}` },
        () => queryClient.invalidateQueries({ queryKey: ["members", activeId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeId, queryClient]);

  return (
    <HouseholdContext.Provider
      value={{
        households,
        activeHousehold,
        activeId,
        setActiveId,
        members,
        profiles,
        myRole,
        loading: householdsQuery.isLoading,
        refetchHouseholds: () => householdsQuery.refetch(),
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold muss innerhalb von HouseholdProvider verwendet werden");
  return ctx;
}
