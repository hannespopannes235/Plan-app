import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ShoppingCart, X, ListPlus } from "lucide-react";
import { pb } from "@/lib/pocketbase";
import { useAuth } from "@/hooks/useAuth";
import { useHousehold } from "@/hooks/useHousehold";
import { useRealtimeTable } from "@/hooks/useRealtime";
import { useToast } from "@/components/ui/toast";
import { SHOPPING_CATEGORIES } from "@/lib/constants";
import type { ShoppingItem, ShoppingList } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLoader, EmptyState } from "@/components/common";
import { cn } from "@/lib/utils";

const QUICK_ITEMS = ["Milch", "Brot", "Eier", "Butter", "Käse", "Bananen", "Kaffee", "Klopapier"];

export function ShoppingPage() {
  const { activeId } = useHousehold();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newCat, setNewCat] = useState<string>("Sonstiges");

  useRealtimeTable("shopping_lists", activeId, ["shopping_lists", activeId]);
  useRealtimeTable("shopping_items", activeId, ["shopping_items", activeId]);

  const listsQuery = useQuery({
    queryKey: ["shopping_lists", activeId],
    enabled: !!activeId,
    queryFn: async (): Promise<ShoppingList[]> =>
      pb.collection("shopping_lists").getFullList<ShoppingList>({
        filter: pb.filter("household_id = {:h}", { h: activeId }),
        sort: "created",
      }),
  });

  const lists = listsQuery.data ?? [];
  const currentListId = activeListId ?? lists[0]?.id ?? null;

  const itemsQuery = useQuery({
    queryKey: ["shopping_items", activeId, currentListId],
    enabled: !!currentListId,
    queryFn: async (): Promise<ShoppingItem[]> =>
      pb.collection("shopping_items").getFullList<ShoppingItem>({
        filter: pb.filter("list_id = {:l}", { l: currentListId }),
        sort: "created",
      }),
  });

  const createList = useMutation({
    mutationFn: async (name: string) =>
      pb.collection("shopping_lists").create<ShoppingList>({ household_id: activeId, name }),
    onSuccess: (list) => {
      qc.invalidateQueries({ queryKey: ["shopping_lists", activeId] });
      setActiveListId(list.id);
    },
  });

  const addItem = useMutation({
    mutationFn: async () => {
      await pb.collection("shopping_items").create({
        household_id: activeId,
        list_id: currentListId,
        name: newItem.trim(),
        quantity: newQty.trim(),
        category: newCat,
      });
    },
    onSuccess: () => {
      setNewItem("");
      setNewQty("");
      qc.invalidateQueries({ queryKey: ["shopping_items", activeId, currentListId] });
    },
    onError: (e) => toast({ title: "Konnte nicht hinzufügen", description: String(e), variant: "error" }),
  });

  const toggleItem = useMutation({
    mutationFn: async (item: ShoppingItem) => {
      await pb.collection("shopping_items").update(item.id, {
        is_checked: !item.is_checked,
        checked_by: !item.is_checked ? user?.id ?? "" : "",
      });
    },
    // Optimistisches Update
    onMutate: async (item) => {
      const key = ["shopping_items", activeId, currentListId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ShoppingItem[]>(key);
      qc.setQueryData<ShoppingItem[]>(key, (old) =>
        (old ?? []).map((i) => (i.id === item.id ? { ...i, is_checked: !i.is_checked } : i)),
      );
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["shopping_items", activeId, currentListId] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await pb.collection("shopping_items").delete(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping_items", activeId, currentListId] }),
  });

  const clearChecked = useMutation({
    mutationFn: async () => {
      const checked = await pb.collection("shopping_items").getFullList<ShoppingItem>({
        filter: pb.filter("list_id = {:l} && is_checked = true", { l: currentListId }),
      });
      await Promise.all(checked.map((i) => pb.collection("shopping_items").delete(i.id)));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping_items", activeId, currentListId] }),
  });

  const quickAdd = (name: string) => {
    pb.collection("shopping_items")
      .create({ household_id: activeId, list_id: currentListId, name })
      .then(() => qc.invalidateQueries({ queryKey: ["shopping_items", activeId, currentListId] }));
  };

  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);
  const grouped = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const it of items) {
      if (!map.has(it.category)) map.set(it.category, []);
      map.get(it.category)!.push(it);
    }
    // Offene zuerst innerhalb der Gruppe
    for (const arr of map.values()) {
      arr.sort((a, b) => Number(a.is_checked) - Number(b.is_checked));
    }
    return Array.from(map.entries());
  }, [items]);

  const openCount = items.filter((i) => !i.is_checked).length;
  const checkedCount = items.length - openCount;

  if (listsQuery.isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Einkauf</h1>
          <p className="text-sm text-muted-foreground">
            {openCount} offen · {checkedCount} erledigt
          </p>
        </div>
        <NewListButton onCreate={(n) => createList.mutate(n)} />
      </div>

      {lists.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart />}
          title="Noch keine Liste"
          description="Lege deine erste Einkaufsliste an."
          action={<NewListButton label="Erste Liste anlegen" onCreate={(n) => createList.mutate(n)} />}
        />
      ) : (
        <>
          {/* Listen-Auswahl */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {lists.map((l) => (
              <button
                key={l.id}
                onClick={() => setActiveListId(l.id)}
                className={cn(
                  "whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  l.id === currentListId
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {l.name}
              </button>
            ))}
          </div>

          {/* Eingabe */}
          <Card>
            <CardContent className="space-y-3 pt-5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newItem.trim()) addItem.mutate();
                }}
                className="flex flex-col gap-2 sm:flex-row"
              >
                <Input
                  placeholder="Artikel hinzufügen…"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Menge"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  className="sm:w-24"
                />
                <Select value={newCat} onValueChange={setNewCat}>
                  <SelectTrigger className="sm:w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOPPING_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" size="icon" disabled={!newItem.trim()}>
                  <Plus className="h-5 w-5" />
                </Button>
              </form>

              {/* Schnellauswahl */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ITEMS.map((q) => (
                  <button
                    key={q}
                    onClick={() => quickAdd(q)}
                    className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/70"
                  >
                    + {q}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Artikel gruppiert */}
          {items.length === 0 ? (
            <EmptyState icon={<ListPlus />} title="Liste ist leer" description="Füge oben Artikel hinzu." />
          ) : (
            <div className="space-y-4">
              {grouped.map(([category, catItems]) => (
                <div key={category}>
                  <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {category}
                  </h3>
                  <Card>
                    <ul className="divide-y divide-border">
                      {catItems.map((item) => (
                        <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                          <Checkbox
                            checked={item.is_checked}
                            onCheckedChange={() => toggleItem.mutate(item)}
                          />
                          <div className="flex-1">
                            <span
                              className={cn(
                                "text-sm",
                                item.is_checked && "text-muted-foreground line-through",
                              )}
                            >
                              {item.name}
                            </span>
                            {item.quantity && (
                              <span className="ml-2 text-xs text-muted-foreground">{item.quantity}</span>
                            )}
                          </div>
                          <button
                            onClick={() => deleteItem.mutate(item.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Löschen"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              ))}

              {checkedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => clearChecked.mutate()}
                >
                  <Trash2 className="h-4 w-4" /> Erledigte entfernen ({checkedCount})
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NewListButton({
  onCreate,
  label = "Liste",
}: {
  onCreate: (name: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> {label}
      </Button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) {
          onCreate(name.trim());
          setName("");
          setOpen(false);
        }
      }}
      className="flex items-center gap-2"
    >
      <Input
        autoFocus
        placeholder="Listenname"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-9 w-40"
        onBlur={() => !name && setOpen(false)}
      />
      <Button type="submit" size="sm">
        OK
      </Button>
    </form>
  );
}
