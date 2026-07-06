import { unzipSync, strFromU8 } from "fflate";

// ============================================================================
// Parser für Mela-Exportdateien.
//   .melarecipe  = einzelnes Rezept als JSON
//   .melarecipes = ZIP-Archiv aus .melarecipe-Dateien
// Format: https://mela.recipes/fileformat/
// ============================================================================

/** Rohes JSON-Format eines .melarecipe-Exports. */
interface MelaJson {
  id?: string;
  title?: string;
  text?: string;
  ingredients?: string;
  instructions?: string;
  notes?: string;
  nutrition?: string;
  categories?: string[];
  yield?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  link?: string;
  images?: string[];
}

export interface ParsedIngredient {
  name: string;
  category: string;
}

export interface ParsedMelaRecipe {
  title: string;
  description: string;
  instructions: string;
  servings: number | null;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  link: string;
  ingredients: ParsedIngredient[];
  /** Erstes Rezeptfoto, dekodiert aus base64 (Mela bettet Bilder direkt ein). */
  image: Blob | null;
}

/**
 * Zutaten-Text in Einzelzutaten zerlegen. Mela nutzt eine Zeile pro Zutat;
 * Zeilen mit führendem „#" sind Abschnitts-Überschriften (z. B. „#Teig") und
 * werden als Kategorie an die folgenden Zutaten gehängt.
 * Menge und Name bleiben zusammen in einer Zeile („200 g Mehl") – das
 * zuverlässige Auftrennen ist nicht möglich, und für Wochenplan/Einkaufsliste
 * reicht die Gesamtzeile.
 */
export function parseIngredientLines(text: string): ParsedIngredient[] {
  const out: ParsedIngredient[] = [];
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      section = line.replace(/^#+\s*/, "").trim();
      continue;
    }
    out.push({ name: line, category: section });
  }
  return out;
}

/** Erste Zahl aus einer Portionsangabe wie „4 servings" oder „2–3" ziehen. */
export function parseServings(yieldText: string | undefined): number | null {
  const m = (yieldText ?? "").match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** base64-Bild in einen Blob umwandeln (mit einfacher Formaterkennung). */
function base64ToBlob(b64: string): Blob | null {
  try {
    const clean = b64.replace(/^data:[^,]+,/, "");
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    return new Blob([bytes], { type: isPng ? "image/png" : "image/jpeg" });
  } catch {
    return null;
  }
}

function fromJson(json: MelaJson): ParsedMelaRecipe {
  const notes = (json.notes ?? "").trim();
  const instructions =
    (json.instructions ?? "").trim() + (notes ? `\n\nNotizen:\n${notes}` : "");
  return {
    title: (json.title ?? "").trim() || "Importiertes Rezept",
    description: (json.text ?? "").trim(),
    instructions: instructions.trim(),
    servings: parseServings(json.yield),
    prepTime: (json.prepTime ?? "").trim(),
    cookTime: (json.cookTime ?? "").trim(),
    totalTime: (json.totalTime ?? "").trim(),
    link: (json.link ?? "").trim(),
    ingredients: parseIngredientLines(json.ingredients ?? ""),
    image: json.images?.length ? base64ToBlob(json.images[0]) : null,
  };
}

/**
 * Eine Mela-Exportdatei einlesen. Wirft bei nicht lesbarem Inhalt einen Error
 * mit verständlicher Meldung.
 */
export async function parseMelaFile(file: File): Promise<ParsedMelaRecipe[]> {
  const buf = new Uint8Array(await file.arrayBuffer());

  // ZIP-Archiv? (.melarecipes beginnt mit der ZIP-Signatur „PK")
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const entries = unzipSync(buf);
    const recipes: ParsedMelaRecipe[] = [];
    for (const [name, data] of Object.entries(entries)) {
      if (!data.length || name.endsWith("/")) continue;
      try {
        recipes.push(fromJson(JSON.parse(strFromU8(data))));
      } catch {
        // einzelne defekte Einträge überspringen statt Gesamtimport abzubrechen
      }
    }
    if (recipes.length === 0) {
      throw new Error("Das Archiv enthält keine lesbaren Mela-Rezepte.");
    }
    return recipes;
  }

  // Einzelnes .melarecipe (JSON)
  try {
    return [fromJson(JSON.parse(strFromU8(buf)))];
  } catch {
    throw new Error("Die Datei ist keine gültige Mela-Exportdatei (.melarecipe/.melarecipes).");
  }
}
