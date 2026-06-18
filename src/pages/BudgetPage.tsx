import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Wallet, Receipt, CalendarClock, TrendingUp } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import { pb } from "@/lib/pocketbase";
import { useAuth } from "@/hooks/useAuth";
import { useHousehold } from "@/hooks/useHousehold";
import { useRealtimeTable } from "@/hooks/useRealtime";
import { useToast } from "@/components/ui/toast";
import { EXPENSE_CATEGORIES, CATEGORY_COLORS, RECURRENCE_LABELS } from "@/lib/constants";
import { formatCurrency, toISODate, formatDateLong, cn } from "@/lib/utils";
import type { RecurrenceFreq, RecurringBill, Transaction } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberAvatar } from "@/components/MemberAvatar";
import { PageLoader, EmptyState } from "@/components/common";

export function BudgetPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Budget</h1>
        <p className="text-sm text-muted-foreground">Ausgaben & wiederkehrende Rechnungen</p>
      </div>
      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Ausgaben</TabsTrigger>
          <TabsTrigger value="bills">Rechnungen</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses">
          <ExpensesTab />
        </TabsContent>
        <TabsContent value="bills">
          <BillsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ExpensesTab() {
  const { activeId, members, profiles } = useHousehold();
  const qc = useQueryClient();
  const key = ["transactions", activeId];

  useRealtimeTable("transactions", activeId, key);

  const txQuery = useQuery({
    queryKey: key,
    enabled: !!activeId,
    queryFn: async (): Promise<Transaction[]> =>
      pb.collection("transactions").getFullList<Transaction>({
        filter: pb.filter("household_id = {:h}", { h: activeId }),
        sort: "-date",
      }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await pb.collection("transactions").delete(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const tx = txQuery.data ?? [];
  const month = toISODate(new Date()).slice(0, 7);
  const monthTx = tx.filter((t) => t.date.startsWith(month));

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTx) map[t.category] = (map[t.category] ?? 0) + t.amount;
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthTx]);

  // Wer hat wie viel bezahlt (einfache Abrechnung)
  const byPayer = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of monthTx) {
      if (t.paid_by) map[t.paid_by] = (map[t.paid_by] ?? 0) + t.amount;
    }
    return map;
  }, [monthTx]);

  const total = monthTx.reduce((s, t) => s + t.amount, 0);
  const fairShare = members.length > 0 ? total / members.length : 0;

  if (txQuery.isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
        </p>
        <ExpenseDialog />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span>Diesen Monat</span>
            <span className="text-2xl font-bold text-primary">{formatCurrency(total)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Noch keine Ausgaben in diesem Monat.
            </p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {byCategory.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={CATEGORY_COLORS[entry.name] ?? "#64748b"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => formatCurrency(v)}
                      contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 24px -8px rgba(0,0,0,0.2)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {byCategory.map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[c.name] ?? "#64748b" }}
                    />
                    <span className="flex-1">{c.name}</span>
                    <span className="font-medium">{formatCurrency(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Abrechnung zwischen Mitgliedern */}
      {total > 0 && members.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" /> Abrechnung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Fairer Anteil pro Person: {formatCurrency(fairShare)}
            </p>
            {members.map((m) => {
              const paid = byPayer[m.user_id] ?? 0;
              const balance = paid - fairShare;
              return (
                <div key={m.user_id} className="flex items-center gap-2 text-sm">
                  <MemberAvatar profile={profiles[m.user_id]} size="sm" />
                  <span className="flex-1">{profiles[m.user_id]?.display_name ?? "Mitglied"}</span>
                  <span className="text-xs text-muted-foreground">{formatCurrency(paid)} bezahlt</span>
                  <span
                    className={cn(
                      "w-24 text-right font-medium",
                      balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                    )}
                  >
                    {balance >= 0 ? "bekommt " : "schuldet "}
                    {formatCurrency(Math.abs(balance))}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Liste */}
      {tx.length === 0 ? (
        <EmptyState icon={<Wallet />} title="Keine Ausgaben" description="Erfasse eure erste gemeinsame Ausgabe." />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {tx.slice(0, 50).map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-semibold"
                  style={{
                    backgroundColor: `${CATEGORY_COLORS[t.category] ?? "#64748b"}22`,
                    color: CATEGORY_COLORS[t.category] ?? "#64748b",
                  }}
                >
                  {t.category.slice(0, 2)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.category} · {formatDateLong(t.date)}
                    {t.paid_by && ` · ${profiles[t.paid_by]?.display_name ?? ""}`}
                  </p>
                </div>
                <span className="font-semibold">{formatCurrency(t.amount)}</span>
                <button
                  onClick={() => remove.mutate(t.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function ExpenseDialog() {
  const { activeId, members, profiles } = useHousehold();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("Lebensmittel");
  const [paidBy, setPaidBy] = useState<string>(user?.id ?? "none");
  const [date, setDate] = useState(toISODate(new Date()));

  const create = useMutation({
    mutationFn: async () => {
      await pb.collection("transactions").create({
        household_id: activeId,
        description: description.trim(),
        amount: Number(amount.replace(",", ".")),
        category,
        paid_by: paidBy === "none" ? "" : paidBy,
        date,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", activeId] });
      setDescription("");
      setAmount("");
      setOpen(false);
      toast({ title: "Ausgabe erfasst", variant: "success" });
    },
    onError: (e) => toast({ title: "Fehler", description: String(e), variant: "error" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Ausgabe
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Ausgabe</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (description.trim() && amount) create.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="e-desc">Beschreibung</Label>
              <Input
                id="e-desc"
                autoFocus
                required
                placeholder="z. B. Wocheneinkauf"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-amt">Betrag (€)</Label>
              <Input
                id="e-amt"
                required
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-date">Datum</Label>
              <Input id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Bezahlt von</Label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {profiles[m.user_id]?.display_name ?? "Mitglied"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!description.trim() || !amount}>
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BillsTab() {
  const { activeId } = useHousehold();
  const qc = useQueryClient();
  const key = ["recurring_bills", activeId];

  useRealtimeTable("recurring_bills", activeId, key);

  const billsQuery = useQuery({
    queryKey: key,
    enabled: !!activeId,
    queryFn: async (): Promise<RecurringBill[]> =>
      pb.collection("recurring_bills").getFullList<RecurringBill>({
        filter: pb.filter("household_id = {:h}", { h: activeId }),
        sort: "next_due_date",
      }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await pb.collection("recurring_bills").delete(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const bills = billsQuery.data ?? [];
  const today = toISODate(new Date());
  const monthlyTotal = bills
    .filter((b) => b.recurrence === "monthly")
    .reduce((s, b) => s + b.amount, 0);

  const chartData = bills.map((b) => ({ name: b.name, value: b.amount }));

  if (billsQuery.isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Monatliche Fixkosten:{" "}
          <span className="font-semibold text-foreground">{formatCurrency(monthlyTotal)}</span>
        </p>
        <BillDialog />
      </div>

      {bills.length === 0 ? (
        <EmptyState
          icon={<Receipt />}
          title="Keine Rechnungen"
          description="Trage wiederkehrende Rechnungen wie Miete oder Strom ein."
        />
      ) : (
        <>
          {chartData.length > 0 && (
            <Card>
              <CardContent className="pt-5">
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 16 }}>
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={90}
                        tick={{ fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v: number) => formatCurrency(v)}
                        contentStyle={{ borderRadius: 12, border: "none" }}
                      />
                      <Bar dataKey="value" fill="#f59e0b" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <ul className="divide-y divide-border">
              {bills.map((b) => {
                const due = new Date(b.next_due_date);
                const diffDays = Math.ceil((due.getTime() - new Date(today).getTime()) / 86400000);
                const soon = diffDays <= b.reminder_days;
                return (
                  <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {RECURRENCE_LABELS[b.recurrence]} · {b.category}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(b.amount)}</p>
                      <p
                        className={cn(
                          "flex items-center justify-end gap-1 text-xs",
                          soon ? "font-medium text-destructive" : "text-muted-foreground",
                        )}
                      >
                        <CalendarClock className="h-3 w-3" />
                        {diffDays < 0
                          ? "überfällig"
                          : diffDays === 0
                            ? "heute fällig"
                            : `in ${diffDays} Tg.`}
                      </p>
                    </div>
                    <button
                      onClick={() => remove.mutate(b.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}

function BillDialog() {
  const { activeId } = useHousehold();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Fixkosten");
  const [recurrence, setRecurrence] = useState<RecurrenceFreq>("monthly");
  const [nextDue, setNextDue] = useState(toISODate(new Date()));

  const create = useMutation({
    mutationFn: async () => {
      await pb.collection("recurring_bills").create({
        household_id: activeId,
        name: name.trim(),
        amount: Number(amount.replace(",", ".")),
        category,
        recurrence,
        next_due_date: nextDue,
        reminder_days: 3,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring_bills", activeId] });
      setName("");
      setAmount("");
      setOpen(false);
      toast({ title: "Rechnung gespeichert", variant: "success" });
    },
    onError: (e) => toast({ title: "Fehler", description: String(e), variant: "error" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Rechnung
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wiederkehrende Rechnung</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && amount) create.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="b-name">Name</Label>
              <Input
                id="b-name"
                autoFocus
                required
                placeholder="z. B. Miete"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-amt">Betrag (€)</Label>
              <Input
                id="b-amt"
                required
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Intervall</Label>
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceFreq)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["daily", "weekly", "monthly"] as RecurrenceFreq[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {RECURRENCE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-due">Nächste Fälligkeit</Label>
              <Input id="b-due" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-cat">Kategorie</Label>
            <Input id="b-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!name.trim() || !amount}>
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
