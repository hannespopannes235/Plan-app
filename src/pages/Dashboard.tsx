import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ShoppingCart,
  CheckSquare,
  UtensilsCrossed,
  Wallet,
  ChevronRight,
  Receipt,
} from "lucide-react";
import { pb } from "@/lib/pocketbase";
import { useAuth } from "@/hooks/useAuth";
import { useHousehold } from "@/hooks/useHousehold";
import { MEAL_SLOT_LABELS } from "@/lib/constants";
import { toISODate, formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { MemberAvatar } from "@/components/MemberAvatar";
import { PageLoader } from "@/components/common";

export function Dashboard() {
  const { user } = useAuth();
  const { activeId, profiles, members } = useHousehold();
  const today = toISODate(new Date());
  const month = today.slice(0, 7);
  const myName = user ? profiles[user.id]?.display_name : null;

  const summary = useQuery({
    queryKey: ["dashboard", activeId, today],
    enabled: !!activeId,
    queryFn: async () => {
      const [openItems, todayTasks, todayMeals, monthTx, soonBills] = await Promise.all([
        pb.collection("shopping_items").getList(1, 1, {
          filter: pb.filter("household_id = {:h} && is_checked = false", { h: activeId }),
        }),
        pb.collection("tasks").getFullList<{ id: string; title: string; assignee_id: string }>({
          filter: pb.filter(
            'household_id = {:h} && is_done = false && due_date != "" && due_date <= {:t}',
            { h: activeId, t: today },
          ),
        }),
        pb
          .collection("meal_plan_entries")
          .getFullList<{
            slot: keyof typeof MEAL_SLOT_LABELS;
            custom_title: string;
            expand?: { recipe_id?: { title: string } };
          }>({
            filter: pb.filter("household_id = {:h} && date = {:t}", { h: activeId, t: today }),
            expand: "recipe_id",
          }),
        pb.collection("transactions").getFullList<{ amount: number }>({
          filter: pb.filter("household_id = {:h} && date >= {:m}", { h: activeId, m: `${month}-01` }),
        }),
        pb.collection("recurring_bills").getList<{
          id: string;
          name: string;
          amount: number;
          next_due_date: string;
        }>(1, 3, {
          filter: pb.filter("household_id = {:h}", { h: activeId }),
          sort: "next_due_date",
        }),
      ]);

      const monthTotal = monthTx.reduce((s, t) => s + Number(t.amount), 0);
      return {
        openItemsCount: openItems.totalItems,
        todayTasks,
        todayMeals: todayMeals.map((m) => ({
          slot: m.slot,
          title: m.custom_title || m.expand?.recipe_id?.title || "Mahlzeit",
        })),
        monthTotal,
        soonBills: soonBills.items,
      };
    },
  });

  if (summary.isLoading || !summary.data) return <PageLoader />;
  const d = summary.data;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return "Guten Morgen";
    if (h < 18) return "Hallo";
    return "Guten Abend";
  })();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}
            {myName ? `, ${myName}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("de-DE", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <div className="flex -space-x-2">
          {members.slice(0, 5).map((m) => (
            <MemberAvatar key={m.user_id} profile={profiles[m.user_id]} size="sm" showRing />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          to="/einkauf"
          icon={<ShoppingCart className="h-5 w-5" />}
          color="#3b82f6"
          value={d.openItemsCount}
          label="offene Artikel"
        />
        <StatCard
          to="/aufgaben"
          icon={<CheckSquare className="h-5 w-5" />}
          color="#10b981"
          value={d.todayTasks.length}
          label="Aufgaben heute"
        />
        <StatCard
          to="/budget"
          icon={<Wallet className="h-5 w-5" />}
          color="#f59e0b"
          value={formatCurrency(d.monthTotal)}
          label="Ausgaben diesen Monat"
        />
        <StatCard
          to="/essensplan"
          icon={<UtensilsCrossed className="h-5 w-5" />}
          color="#ec4899"
          value={d.todayMeals.length}
          label="Mahlzeiten heute"
        />
      </div>

      {/* Heute essen */}
      {d.todayMeals.length > 0 && (
        <SectionCard title="Heute auf dem Tisch" to="/essensplan">
          <ul className="space-y-1.5">
            {d.todayMeals.map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="text-xs font-medium text-muted-foreground">
                  {MEAL_SLOT_LABELS[m.slot]}
                </span>
                <span className="font-medium">{m.title}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Aufgaben heute */}
      {d.todayTasks.length > 0 && (
        <SectionCard title="Heute zu erledigen" to="/aufgaben">
          <ul className="space-y-2">
            {d.todayTasks.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="flex-1">{t.title}</span>
                {t.assignee_id && <MemberAvatar profile={profiles[t.assignee_id]} size="sm" />}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Anstehende Rechnungen */}
      {d.soonBills.length > 0 && (
        <SectionCard title="Nächste Rechnungen" to="/budget">
          <ul className="space-y-2">
            {d.soonBills.map((b) => (
              <li key={b.id} className="flex items-center gap-2 text-sm">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">{b.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(b.next_due_date).toLocaleDateString("de-DE", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
                <span className="font-medium">{formatCurrency(Number(b.amount))}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function StatCard({
  to,
  icon,
  color,
  value,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  color: string;
  value: React.ReactNode;
  label: string;
}) {
  return (
    <Link to={to}>
      <Card className="transition-transform active:scale-[0.98]">
        <CardContent className="flex flex-col gap-1 py-4">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}22`, color }}
          >
            {icon}
          </span>
          <span className="mt-1 text-2xl font-bold leading-none">{value}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

function SectionCard({
  title,
  to,
  children,
}: {
  title: string;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <Link to={to} className="flex items-center text-xs text-muted-foreground hover:text-foreground">
            Alle <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
