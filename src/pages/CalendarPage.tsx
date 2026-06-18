import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Copy, Check, CheckSquare, UtensilsCrossed, Receipt } from "lucide-react";
import { pb, icsUrl } from "@/lib/pocketbase";
import { useHousehold } from "@/hooks/useHousehold";
import { useToast } from "@/components/ui/toast";
import { MEAL_SLOT_LABELS } from "@/lib/constants";
import { toISODate, formatDateLong, formatCurrency, copyToClipboard } from "@/lib/utils";
import type { MealSlot } from "@/types/database";
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
        pb.collection("tasks").getFullList<{ title: string; due_date: string; is_done: boolean }>({
          filter: pb.filter(
            'household_id = {:h} && due_date != "" && due_date >= {:from} && due_date <= {:to}',
            { h: activeId, from: today, to: horizon },
          ),
        }),
        pb
          .collection("meal_plan_entries")
          .getFullList<{
            date: string;
            slot: MealSlot;
            custom_title: string;
            expand?: { recipe_id?: { title: string } };
          }>({
            filter: pb.filter("household_id = {:h} && date >= {:from} && date <= {:to}", {
              h: activeId,
              from: today,
              to: horizon,
            }),
            expand: "recipe_id",
          }),
        pb
          .collection("recurring_bills")
          .getFullList<{ name: string; amount: number; next_due_date: string }>({
            filter: pb.filter(
              "household_id = {:h} && next_due_date >= {:from} && next_due_date <= {:to}",
              { h: activeId, from: today, to: horizon },
            ),
          }),
      ]);

      const items: AgendaItem[] = [];
      for (const t of tasks) {
        items.push({
          date: t.due_date,
          kind: "task",
          label: t.title,
          meta: t.is_done ? "erledigt" : "Aufgabe",
        });
      }
      for (const m of meals) {
        items.push({
          date: m.date,
          kind: "meal",
          label: m.custom_title || m.expand?.recipe_id?.title || "Mahlzeit",
          meta: MEAL_SLOT_LABELS[m.slot],
        });
      }
      for (const b of bills) {
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
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link kopiert", variant: "success" });
    } else {
      toast({
        title: "Kopieren nicht möglich",
        description: "Markiere die URL und kopiere sie manuell.",
        variant: "error",
      });
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
