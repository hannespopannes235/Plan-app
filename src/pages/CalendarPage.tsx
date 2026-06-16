import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Copy, Check, CheckSquare, UtensilsCrossed, Receipt } from "lucide-react";
import { supabase, icsUrl } from "@/lib/supabase";
import { useHousehold } from "@/hooks/useHousehold";
import { useToast } from "@/components/ui/toast";
import { MEAL_SLOT_LABELS } from "@/lib/constants";
import { toISODate, formatDateLong, formatCurrency } from "@/lib/utils";
import type { MealPlanEntry, RecurringBill, Task } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader, EmptyState } from "@/components/common";

type AgendaItem = {
  date: string;
  kind: "task" | "meal" | "bill";
  label: string;
  meta?: string;
};

export function CalendarPage() {
  const { activeId, activeHousehold } = useHousehold();

  const today = toISODate(new Date());
  const horizon = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return toISODate(d);
  }, []);

  const agendaQuery = useQuery({
    queryKey: ["agenda", activeId, today],
    enabled: !!activeId,
    queryFn: async (): Promise<AgendaItem[]> => {
      const [tasks, meals, bills] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, due_date, is_done")
          .eq("household_id", activeId!)
          .not("due_date", "is", null)
          .gte("due_date", today)
          .lte("due_date", horizon),
        supabase
          .from("meal_plan_entries")
          .select("id, date, slot, custom_title, recipes(title)")
          .eq("household_id", activeId!)
          .gte("date", today)
          .lte("date", horizon),
        supabase
          .from("recurring_bills")
          .select("id, name, amount, next_due_date")
          .eq("household_id", activeId!)
          .gte("next_due_date", today)
          .lte("next_due_date", horizon),
      ]);

      const items: AgendaItem[] = [];
      for (const t of (tasks.data ?? []) as Task[]) {
        if (t.due_date)
          items.push({
            date: t.due_date,
            kind: "task",
            label: t.title,
            meta: t.is_done ? "erledigt" : "Aufgabe",
          });
      }
      type MealRow = Pick<MealPlanEntry, "date" | "slot" | "custom_title"> & {
        recipes: { title: string } | { title: string }[] | null;
      };
      for (const m of (meals.data ?? []) as unknown as MealRow[]) {
        const recipeTitle = Array.isArray(m.recipes) ? m.recipes[0]?.title : m.recipes?.title;
        items.push({
          date: m.date,
          kind: "meal",
          label: m.custom_title ?? recipeTitle ?? "Mahlzeit",
          meta: MEAL_SLOT_LABELS[m.slot],
        });
      }
      for (const b of (bills.data ?? []) as RecurringBill[]) {
        items.push({
          date: b.next_due_date,
          kind: "bill",
          label: b.name,
          meta: formatCurrency(Number(b.amount)),
        });
      }
      return items.sort((a, b) => a.date.localeCompare(b.date));
    },
  });

  const items = useMemo(() => agendaQuery.data ?? [], [agendaQuery.data]);
  const grouped = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const it of items) {
      if (!map.has(it.date)) map.set(it.date, []);
      map.get(it.date)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kalender</h1>
        <p className="text-sm text-muted-foreground">Aufgaben, Mahlzeiten & Rechnungen – die nächsten 30 Tage</p>
      </div>

      {activeHousehold && <IcsSubscribe token={activeHousehold.ics_token} />}

      {agendaQuery.isLoading ? (
        <PageLoader />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="Nichts geplant"
          description="Sobald Aufgaben, Mahlzeiten oder Rechnungen anstehen, erscheinen sie hier."
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, dayItems]) => (
            <div key={date}>
              <h3 className="mb-1.5 px-1 text-sm font-semibold">
                {formatDateLong(date)}
                {date === today && <span className="ml-2 text-xs text-primary">Heute</span>}
              </h3>
              <Card>
                <ul className="divide-y divide-border">
                  {dayItems.map((it, i) => (
                    <li key={i} className="flex items-center gap-3 px-4 py-3">
                      <AgendaIcon kind={it.kind} />
                      <span className="flex-1 text-sm font-medium">{it.label}</span>
                      <span className="text-xs text-muted-foreground">{it.meta}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgendaIcon({ kind }: { kind: AgendaItem["kind"] }) {
  const map = {
    task: { icon: CheckSquare, color: "#3b82f6" },
    meal: { icon: UtensilsCrossed, color: "#10b981" },
    bill: { icon: Receipt, color: "#f59e0b" },
  } as const;
  const { icon: Icon, color } = map[kind];
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: `${color}22`, color }}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

function IcsSubscribe({ token }: { token: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const url = icsUrl(token);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link kopiert", variant: "success" });
    } catch {
      toast({ title: "Kopieren nicht möglich", variant: "error" });
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" /> In Google/Apple Kalender abonnieren
        </CardTitle>
        <CardDescription>
          Diese URL einmal als „Kalender abonnieren" (per URL) eintragen – Termine erscheinen dann
          automatisch und aktualisieren sich.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button variant="outline" size="icon" onClick={copy} aria-label="Link kopieren">
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </CardContent>
    </Card>
  );
}
