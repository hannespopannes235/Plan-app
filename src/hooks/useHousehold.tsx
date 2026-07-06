import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { pb } from "@/lib/pocketbase";
import { useAuth } from "@/hooks/useAuth";
import type { Household, HouseholdMember, Profile } from "@/types/database";

interface HouseholdContextValue {
  households: Household[];
  activeHousehold: Household | null;
  activeId: string | null;
  setActiveId: (id: string) => void;
  members: HouseholdMember[];
  /** user_id → Profile (eigenes Profil + alle Mitglieder). */
  profiles: Record<string, Profile>;
  myRole: string | null;
  loading: boolean;
  refetchHouseholds: () => void;
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

const ACTIVE_KEY = "plan-active-household";

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeId, setActiveIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_KEY),
  );

  const householdsQuery = useQuery({
    queryKey: ["households", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Household[]> => {
      return pb.collection("households").getFullList<Household>({ sort: "created" });
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
      const records = await pb.collection("household_members").getFullList<
        HouseholdMember & { expand?: { user_id?: Profile } }
      >({
        filter: pb.filter("household_id = {:h}", { h: activeId }),
        expand: "user_id",
      });
      const profiles: Profile[] = [];
      for (const m of records) {
        const u = m.expand?.user_id;
        if (u) {
          profiles.push({
            id: u.id,
            display_name: u.display_name || "Mitglied",
            color: u.color || "#f59e0b",
            avatar_emoji: u.avatar_emoji || "🙂",
          });
        }
      }
      return { members: records, profiles };
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
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    pb.collection("household_members")
      .subscribe("*", () => membersQuery.refetch())
      .then((u) => {
        if (cancelled) u();
        else unsubscribe = u;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

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
