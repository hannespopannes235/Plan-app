import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  UtensilsCrossed,
  Trash2,
  ShoppingCart,
  X,
  Clock,
  ExternalLink,
} from "lucide-react";
import { pb } from "@/lib/pocketbase";
import { useHousehold } from "@/hooks/useHousehold";
import { useRealtimeTable } from "@/hooks/useRealtime";
import { useToast } from "@/components/ui/toast";
import { MEAL_SLOT_LABELS, WEEKDAY_LABELS } from "@/lib/constants";
import { toISODate, cn } from "@/lib/utils";
import type { MealPlanEntry, MealSlot, Recipe, RecipeIngredient, ShoppingList } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { RecipeImportDialog } from "@/components/RecipeImportDialog";
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
import { PageLoader, EmptyState } from "@/components/common";

/** Montag der Woche, in der `date` liegt. */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Mo=0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function MealPlanPage() {
  const [tab, setTab] = useState("plan");
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Essensplan</h1>
          <p className="text-sm text-muted-foreground">Woche planen & Rezepte verwalten</p>
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="plan">Wochenplan</TabsTrigger>
          <TabsTrigger value="recipes">Rezepte</TabsTrigger>
        </TabsList>
        <TabsContent value="plan">
          <WeekPlan />
        </TabsContent>
        <TabsContent value="recipes">
          <RecipesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WeekPlan() {
  const { activeId } = useHousehold();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  const from = toISODate(days[0]);
  const to = toISODate(days[6]);

  useRealtimeTable("meal_plan_entries", activeId, ["meals", activeId]);

  const entriesQuery = useQuery({
    queryKey: ["meals", activeId, from],
    enabled: !!activeId,
    queryFn: async (): Promise<MealPlanEntry[]> =>
      pb.collection("meal_plan_entries").getFullList<MealPlanEntry>({
        filter: pb.filter("household_id = {:h} && date >= {:from} && date <= {:to}", {
          h: activeId,
          from,
          to,
        }),
      }),
  });

  const recipesQuery = useQuery({
    queryKey: ["recipes", activeId],
    enabled: !!activeId,
    queryFn: async (): Promise<Recipe[]> =>
      pb.collection("recipes").getFullList<Recipe>({
        filter: pb.filter("household_id = {:h}", { h: activeId }),
      }),
  });

  const recipes = recipesQuery.data ?? [];
  const entries = entriesQuery.data ?? [];

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      await pb.collection("meal_plan_entries").delete(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meals", activeId, from] }),
  });

  const generateList = useMutation({
    mutationFn: async () => {
      const recipeIds = new Set(entries.map((e) => e.recipe_id).filter(Boolean) as string[]);
      if (recipeIds.size === 0) throw new Error("Keine Rezepte im Plan");

      // Alle Zutaten des Haushalts laden und auf die geplanten Rezepte filtern
      const allIngredients = await pb.collection("recipe_ingredients").getFullList<RecipeIngredient>({
        filter: pb.filter("household_id = {:h}", { h: activeId }),
      });
      const ings = allIngredients.filter((i) => recipeIds.has(i.recipe_id));

      const list = await pb.collection("shopping_lists").create<ShoppingList>({
        household_id: activeId,
        name: `Wochenplan ${from}`,
      });

      await Promise.all(
        ings.map((i) =>
          pb.collection("shopping_items").create({
            household_id: activeId,
            list_id: list.id,
            name: i.name,
            quantity: i.quantity ?? "",
            category: i.category,
          }),
        ),
      );
      return ings.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["shopping_lists", activeId] });
      toast({
        title: "Einkaufsliste erstellt",
        description: `${count} Zutaten übernommen.`,
        variant: "success",
      });
    },
    onError: (e) =>
      toast({ title: "Konnte Liste nicht erstellen", description: String(e), variant: "error" }),
  });

  if (entriesQuery.isLoading) return <PageLoader />;

  const today = toISODate(new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() - 7);
            setWeekStart(d);
          }}
          aria-label="Vorherige Woche"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium">
          {days[0].toLocaleDateString("de-DE", { day: "numeric", month: "short" })} –{" "}
          {days[6].toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + 7);
            setWeekStart(d);
          }}
          aria-label="Nächste Woche"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-2">
        {days.map((day, idx) => {
          const iso = toISODate(day);
          const dayEntries = entries.filter((e) => e.date === iso);
          return (
            <Card key={iso} className={cn(iso === today && "border-primary/50")}>
              <CardContent className="flex items-start gap-3 py-3">
                <div className="w-12 shrink-0 text-center">
                  <div className="text-xs font-medium text-muted-foreground">{WEEKDAY_LABELS[idx]}</div>
                  <div className={cn("text-lg font-semibold", iso === today && "text-primary")}>
                    {day.getDate()}
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  {dayEntries.length === 0 && (
                    <span className="text-sm text-muted-foreground">Nichts geplant</span>
                  )}
                  {dayEntries.map((e) => {
                    const recipe = recipes.find((r) => r.id === e.recipe_id);
                    return (
                      <span
                        key={e.id}
                        className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
                      >
                        <span className="opacity-60">{MEAL_SLOT_LABELS[e.slot].slice(0, 1)}</span>
                        {e.custom_title || recipe?.title || "Mahlzeit"}
                        <button onClick={() => removeEntry.mutate(e.id)} aria-label="Entfernen">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                  <AddMealDialog date={iso} recipes={recipes} weekFrom={from} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button variant="secondary" className="w-full" onClick={() => generateList.mutate()}>
        <ShoppingCart className="h-4 w-4" /> Einkaufsliste aus Woche erstellen
      </Button>
    </div>
  );
}

function AddMealDialog({
  date,
  recipes,
  weekFrom,
}: {
  date: string;
  recipes: Recipe[];
  weekFrom: string;
}) {
  const { activeId } = useHousehold();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState<MealSlot>("dinner");
  const [recipeId, setRecipeId] = useState<string>("custom");
  const [custom, setCustom] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      await pb.collection("meal_plan_entries").create({
        household_id: activeId,
        date,
        slot,
        recipe_id: recipeId === "custom" ? "" : recipeId,
        custom_title: recipeId === "custom" ? custom.trim() || "Mahlzeit" : "",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meals", activeId, weekFrom] });
      setCustom("");
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
          aria-label="Mahlzeit hinzufügen"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mahlzeit planen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Mahlzeit</Label>
            <Select value={slot} onValueChange={(v) => setSlot(v as MealSlot)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MEAL_SLOT_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Gericht</Label>
            <Select value={recipeId} onValueChange={setRecipeId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Freitext…</SelectItem>
                {recipes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {recipeId === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="m-custom">Was gibt's?</Label>
              <Input
                id="m-custom"
                autoFocus
                placeholder="z. B. Pizza"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Abbrechen</Button>
          </DialogClose>
          <Button onClick={() => add.mutate()}>Hinzufügen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecipesTab() {
  const { activeId } = useHousehold();
  const qc = useQueryClient();

  const recipesQuery = useQuery({
    queryKey: ["recipes", activeId],
    enabled: !!activeId,
    queryFn: async (): Promise<Recipe[]> =>
      pb.collection("recipes").getFullList<Recipe>({
        filter: pb.filter("household_id = {:h}", { h: activeId }),
        sort: "title",
      }),
  });

  const ingredientsQuery = useQuery({
    queryKey: ["recipe_ingredients", activeId],
    enabled: !!activeId,
    queryFn: async (): Promise<RecipeIngredient[]> =>
      pb.collection("recipe_ingredients").getFullList<RecipeIngredient>({
        filter: pb.filter("household_id = {:h}", { h: activeId }),
        sort: "created",
      }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await pb.collection("recipes").delete(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recipes", activeId] }),
  });

  const recipes = recipesQuery.data ?? [];
  const ingredients = ingredientsQuery.data ?? [];

  if (recipesQuery.isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <RecipeDialog />
        <RecipeImportDialog />
      </div>
      {recipes.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed />}
          title="Noch keine Rezepte"
          description="Lege Rezepte an oder importiere sie aus Mela bzw. per Web-Link."
        />
      ) : (
        <div className="space-y-3">
          {recipes.map((r) => {
            const ings = ingredients.filter((i) => i.recipe_id === r.id);
            return (
              <Card key={r.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    {r.image && (
                      <img
                        src={pb.files.getUrl(r, r.image, { thumb: "600x0" })}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-xl object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{r.title}</h3>
                      {r.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                          {r.description}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{r.servings} Portionen</span>
                        {r.total_time && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {r.total_time}
                          </span>
                        )}
                        {r.link && (
                          <a
                            href={r.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" /> Quelle
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => remove.mutate(r.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Rezept löschen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  {ings.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {ings.map((i) => (
                        <span
                          key={i.id}
                          className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground"
                        >
                          {i.quantity ? `${i.quantity} ` : ""}
                          {i.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.instructions && (
                    <details className="mt-3">
                      <summary className="cursor-pointer select-none text-sm font-medium text-primary">
                        Zubereitung anzeigen
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {r.instructions}
                      </p>
                    </details>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface DraftIngredient {
  name: string;
  quantity: string;
}

function RecipeDialog() {
  const { activeId } = useHousehold();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [servings, setServings] = useState(2);
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([{ name: "", quantity: "" }]);

  const create = useMutation({
    mutationFn: async () => {
      const recipe = await pb.collection("recipes").create<Recipe>({
        household_id: activeId,
        title: title.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        servings,
      });

      const valid = ingredients.filter((i) => i.name.trim());
      // sequenziell, damit die eingegebene Reihenfolge erhalten bleibt
      for (const i of valid) {
        await pb.collection("recipe_ingredients").create({
          household_id: activeId,
          recipe_id: recipe.id,
          name: i.name.trim(),
          quantity: i.quantity.trim(),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes", activeId] });
      qc.invalidateQueries({ queryKey: ["recipe_ingredients", activeId] });
      setTitle("");
      setDescription("");
      setInstructions("");
      setServings(2);
      setIngredients([{ name: "", quantity: "" }]);
      setOpen(false);
      toast({ title: "Rezept gespeichert", variant: "success" });
    },
    onError: (e) => toast({ title: "Fehler", description: String(e), variant: "error" }),
  });

  const updateIng = (idx: number, field: keyof DraftIngredient, value: string) => {
    setIngredients((prev) => prev.map((i, x) => (x === idx ? { ...i, [field]: value } : i)));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Neues Rezept
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Rezept</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) create.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="r-title">Titel</Label>
            <Input
              id="r-title"
              autoFocus
              required
              placeholder="z. B. Spaghetti Bolognese"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="r-desc">Beschreibung</Label>
              <Input
                id="r-desc"
                placeholder="optional"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-serv">Portionen</Label>
              <Input
                id="r-serv"
                type="number"
                min={1}
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="r-inst">Zubereitung</Label>
            <Textarea
              id="r-inst"
              placeholder="optional – Schritte, Tipps …"
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Zutaten</Label>
            {ingredients.map((ing, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  placeholder="Menge"
                  value={ing.quantity}
                  onChange={(e) => updateIng(idx, "quantity", e.target.value)}
                  className="w-24"
                />
                <Input
                  placeholder="Zutat"
                  value={ing.name}
                  onChange={(e) => updateIng(idx, "name", e.target.value)}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => setIngredients((p) => p.filter((_, x) => x !== idx))}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Zutat entfernen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIngredients((p) => [...p, { name: "", quantity: "" }])}
            >
              <Plus className="h-4 w-4" /> Zutat
            </Button>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Abbrechen
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!title.trim()}>
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
