import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Globe, FileUp } from "lucide-react";
import { pb } from "@/lib/pocketbase";
import { useHousehold } from "@/hooks/useHousehold";
import { useToast } from "@/components/ui/toast";
import { parseMelaFile, type ParsedMelaRecipe } from "@/lib/mela";
import type { Recipe } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/common";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Rezepte importieren: aus Mela-Exportdateien (.melarecipe/.melarecipes)
 * oder per Web-Link (schema.org-Rezeptdaten, serverseitig geparst).
 */
export function RecipeImportDialog() {
  const { activeId } = useHousehold();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["recipes", activeId] });
    qc.invalidateQueries({ queryKey: ["recipe_ingredients", activeId] });
  };

  const importMela = useMutation({
    mutationFn: async (file: File) => {
      const parsed = await parseMelaFile(file);

      const existing = await pb.collection("recipes").getFullList<Recipe>({
        filter: pb.filter("household_id = {:h}", { h: activeId }),
        fields: "id,title",
      });
      const have = new Set(existing.map((r) => r.title.trim().toLowerCase()));

      let created = 0;
      let skipped = 0;
      let imagesFailed = 0;
      for (const r of parsed) {
        if (have.has(r.title.trim().toLowerCase())) {
          skipped++;
          continue;
        }
        // Rezept zuerst ohne Foto anlegen: ein zu großes/unpassendes Bild
        // soll nicht den ganzen Import blockieren.
        const recipe = await createRecipe(activeId!, r);
        if (r.image) {
          try {
            await attachImage(recipe.id, r.image);
          } catch {
            imagesFailed++;
          }
        }
        // sequenziell, damit die Zutaten-Reihenfolge des Rezepts erhalten bleibt
        for (const ing of r.ingredients) {
          await pb.collection("recipe_ingredients").create({
            household_id: activeId,
            recipe_id: recipe.id,
            name: ing.name,
            quantity: "",
            category: ing.category,
          });
        }
        have.add(r.title.trim().toLowerCase());
        created++;
      }
      return { created, skipped, imagesFailed };
    },
    onSuccess: ({ created, skipped, imagesFailed }) => {
      invalidate();
      setOpen(false);
      const notes = [
        skipped > 0 ? `${skipped} übersprungen (Titel schon vorhanden)` : null,
        imagesFailed > 0 ? `${imagesFailed} Foto${imagesFailed === 1 ? "" : "s"} übersprungen` : null,
      ].filter(Boolean);
      toast({
        title: created > 0 ? `${created} Rezept${created === 1 ? "" : "e"} importiert` : "Nichts importiert",
        description: notes.length > 0 ? notes.join(", ") + "." : undefined,
        variant: created > 0 ? "success" : "error",
      });
    },
    onError: (e) =>
      toast({
        title: "Import fehlgeschlagen",
        description: describeError(e),
        variant: "error",
      }),
  });

  const importUrl = useMutation({
    mutationFn: async () =>
      pb.send<{ title: string; ingredients: number }>("/api/plan/import-recipe-url", {
        method: "POST",
        body: { url: url.trim(), household_id: activeId },
      }),
    onSuccess: (res) => {
      invalidate();
      setUrl("");
      setOpen(false);
      toast({
        title: `„${res.title}" importiert`,
        description: `${res.ingredients} Zutaten übernommen.`,
        variant: "success",
      });
    },
    onError: (e: unknown) => {
      toast({
        title: "Import fehlgeschlagen",
        description: describeError(e),
        variant: "error",
      });
    },
  });

  const busy = importMela.isPending || importUrl.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Download className="h-4 w-4" /> Importieren
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rezepte importieren</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Aus Mela */}
          <div className="space-y-2">
            <Label>Aus Mela</Label>
            <p className="text-sm text-muted-foreground">
              In Mela: Rezept(e) auswählen → Teilen → <strong>Export</strong>. Die Datei
              (.melarecipe oder .melarecipes) hier auswählen – Zutaten, Zubereitung und Foto
              werden übernommen.
            </p>
            <input
              ref={fileInput}
              type="file"
              accept=".melarecipe,.melarecipes"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importMela.mutate(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              {importMela.isPending ? <Spinner /> : <FileUp className="h-4 w-4" />}
              Mela-Datei auswählen
            </Button>
          </div>

          <div className="h-px bg-border" />

          {/* Per URL */}
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) importUrl.mutate();
            }}
          >
            <Label htmlFor="imp-url">Von einer Website</Label>
            <p className="text-sm text-muted-foreground">
              Link zu einem Rezept einfügen (z. B. Chefkoch) – funktioniert mit den meisten
              Koch-Websites.
            </p>
            <div className="flex gap-2">
              <Input
                id="imp-url"
                type="url"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={busy}
              />
              <Button type="submit" disabled={busy || !url.trim()}>
                {importUrl.isPending ? <Spinner className="text-primary-foreground" /> : <Globe className="h-4 w-4" />}
                Laden
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function createRecipe(householdId: string, r: ParsedMelaRecipe): Promise<Recipe> {
  return pb.collection("recipes").create<Recipe>({
    household_id: householdId,
    title: r.title,
    description: r.description,
    servings: r.servings ?? 2,
    instructions: r.instructions,
    link: r.link,
    prep_time: r.prepTime,
    cook_time: r.cookTime,
    total_time: r.totalTime,
  });
}

async function attachImage(recipeId: string, image: Blob): Promise<void> {
  const fd = new FormData();
  fd.set("image", image, image.type === "image/png" ? "rezept.png" : "rezept.jpg");
  await pb.collection("recipes").update(recipeId, fd);
}

/** Lesbare Fehlermeldung aus einem PocketBase-ClientResponseError ziehen. */
function describeError(e: unknown): string {
  const err = e as {
    data?: { message?: string; data?: Record<string, { message?: string }> };
    message?: string;
  };
  const fieldErrors = err?.data?.data;
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    return Object.entries(fieldErrors)
      .map(([field, info]) => `${field}: ${info?.message ?? "ungültig"}`)
      .join(" · ");
  }
  return err?.data?.message || err?.message || String(e);
}
