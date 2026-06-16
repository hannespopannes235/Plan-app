import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, CheckSquare, Repeat, CalendarClock, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useHousehold } from "@/hooks/useHousehold";
import { useRealtimeTable } from "@/hooks/useRealtime";
import { useToast } from "@/components/ui/toast";
import { RECURRENCE_LABELS } from "@/lib/constants";
import { toISODate, formatDateLong, cn } from "@/lib/utils";
import type { RecurrenceFreq, Task } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
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

export function TasksPage() {
  const { activeId, members, profiles } = useHousehold();
  const { toast } = useToast();
  const qc = useQueryClient();
  const key = ["tasks", activeId];

  useRealtimeTable("tasks", activeId, key);

  const tasksQuery = useQuery({
    queryKey: key,
    enabled: !!activeId,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("household_id", activeId!)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const complete = useMutation({
    mutationFn: async (task: Task) => {
      const { error } = await supabase.rpc("complete_task", { p_task_id: task.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast({ title: "Fehler", description: String(e), variant: "error" }),
  });

  const reopen = useMutation({
    mutationFn: async (task: Task) => {
      const { error } = await supabase
        .from("tasks")
        .update({ is_done: false, completed_at: null, completed_by: null })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const today = toISODate(new Date());
  const open = tasks.filter((t) => !t.is_done);

  const todayTasks = open.filter((t) => t.due_date && t.due_date <= today);
  const upcoming = open.filter((t) => !t.due_date || t.due_date > today);

  // Punkte-Statistik (Kür)
  const points = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tasks.filter((t) => t.is_done && t.completed_by)) {
      map[t.completed_by!] = (map[t.completed_by!] ?? 0) + t.points;
    }
    return map;
  }, [tasks]);

  if (tasksQuery.isLoading) return <PageLoader />;

  const renderTask = (t: Task) => {
    const assignee = t.assignee_id ? profiles[t.assignee_id] : null;
    const overdue = t.due_date && t.due_date < today;
    return (
      <li key={t.id} className="flex items-center gap-3 px-4 py-3">
        <Checkbox checked={t.is_done} onCheckedChange={() => (t.is_done ? reopen.mutate(t) : complete.mutate(t))} />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", t.is_done && "text-muted-foreground line-through")}>
            {t.title}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {t.due_date && (
              <span className={cn(overdue && !t.is_done && "font-medium text-destructive")}>
                <CalendarClock className="mr-1 inline h-3 w-3" />
                {formatDateLong(t.due_date)}
              </span>
            )}
            {t.recurrence !== "none" && (
              <span>
                <Repeat className="mr-1 inline h-3 w-3" />
                {RECURRENCE_LABELS[t.recurrence]}
              </span>
            )}
          </div>
        </div>
        {assignee && <MemberAvatar profile={assignee} size="sm" />}
        <button
          onClick={() => remove.mutate(t.id)}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Löschen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </li>
    );
  };

  const list = (arr: Task[], emptyMsg: string) =>
    arr.length === 0 ? (
      <EmptyState icon={<CheckSquare />} title="Alles erledigt!" description={emptyMsg} />
    ) : (
      <Card>
        <ul className="divide-y divide-border">{arr.map(renderTask)}</ul>
      </Card>
    );

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aufgaben</h1>
          <p className="text-sm text-muted-foreground">{open.length} offen</p>
        </div>
        <TaskDialog />
      </div>

      <Tabs defaultValue="today">
        <TabsList className="w-full">
          <TabsTrigger value="today" className="flex-1">
            Heute
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex-1">
            Demnächst
          </TabsTrigger>
          <TabsTrigger value="person" className="flex-1">
            Pro Person
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today">{list(todayTasks, "Für heute ist nichts fällig.")}</TabsContent>
        <TabsContent value="upcoming">{list(upcoming, "Keine anstehenden Aufgaben.")}</TabsContent>
        <TabsContent value="person" className="space-y-4">
          {members.map((m) => {
            const personTasks = open.filter((t) => t.assignee_id === m.user_id);
            const p = profiles[m.user_id];
            return (
              <div key={m.user_id}>
                <div className="mb-1.5 flex items-center gap-2 px-1">
                  <MemberAvatar profile={p} size="sm" />
                  <span className="text-sm font-semibold">{p?.display_name ?? "Mitglied"}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    🏆 {points[m.user_id] ?? 0} Punkte
                  </span>
                </div>
                {personTasks.length === 0 ? (
                  <p className="px-1 text-sm text-muted-foreground">Keine offenen Aufgaben.</p>
                ) : (
                  <Card>
                    <ul className="divide-y divide-border">{personTasks.map(renderTask)}</ul>
                  </Card>
                )}
              </div>
            );
          })}
          {/* Nicht zugewiesen */}
          {(() => {
            const none = open.filter((t) => !t.assignee_id);
            if (none.length === 0) return null;
            return (
              <div>
                <p className="mb-1.5 px-1 text-sm font-semibold text-muted-foreground">
                  Nicht zugewiesen
                </p>
                <Card>
                  <ul className="divide-y divide-border">{none.map(renderTask)}</ul>
                </Card>
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TaskDialog() {
  const { activeId, members, profiles } = useHousehold();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [assignee, setAssignee] = useState<string>("none");
  const [dueDate, setDueDate] = useState(toISODate(new Date()));
  const [recurrence, setRecurrence] = useState<RecurrenceFreq>("none");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({
        household_id: activeId,
        title: title.trim(),
        notes: notes.trim() || null,
        assignee_id: assignee === "none" ? null : assignee,
        due_date: dueDate || null,
        recurrence,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", activeId] });
      setTitle("");
      setNotes("");
      setRecurrence("none");
      setOpen(false);
      toast({ title: "Aufgabe erstellt", variant: "success" });
    },
    onError: (e) => toast({ title: "Fehler", description: String(e), variant: "error" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Aufgabe
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Aufgabe</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) create.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Titel</Label>
            <Input
              id="t-title"
              autoFocus
              required
              placeholder="z. B. Bad putzen"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-notes">Notiz (optional)</Label>
            <Textarea
              id="t-notes"
              placeholder="Details…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Zuständig</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Niemand</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {profiles[m.user_id]?.display_name ?? "Mitglied"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-due">Fällig am</Label>
              <Input
                id="t-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Wiederholung</Label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceFreq)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RECURRENCE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
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
            <Button type="submit" disabled={!title.trim()}>
              Erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
