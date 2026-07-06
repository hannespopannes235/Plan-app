// Gemeinsame Helfer für die Plan-Hooks.
// Wichtig: routerAdd-Handler laufen in isolierten VM-Kontexten – Funktionen
// auf Dateiebene von main.pb.js sind dort nicht sichtbar. Deshalb liegen die
// Helfer hier und werden im Handler per require(`${__hooks}/plan_utils.js`) geladen.

/** Haushalt über sein geheimes ics_token finden (für Kurzbefehle-Endpunkte). */
function findHouseholdByToken(token) {
  if (!token) throw new ForbiddenError("Token fehlt.");
  try {
    return $app.dao().findFirstRecordByData("households", "ics_token", token);
  } catch (e) {
    throw new ForbiddenError("Token ungültig.");
  }
}

/** schema.org/Recipe aus den JSON-LD-Blöcken einer HTML-Seite ziehen. */
function extractRecipeJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) blocks.push(m[1]);

  const isRecipe = (o) => {
    const t = o && o["@type"];
    if (!t) return false;
    return Array.isArray(t) ? t.indexOf("Recipe") !== -1 : String(t) === "Recipe";
  };

  let node = null;
  for (const block of blocks) {
    let data;
    try {
      data = JSON.parse(block.trim());
    } catch (e) {
      continue;
    }
    const candidates = Array.isArray(data) ? data : [data];
    for (const cand of candidates) {
      if (isRecipe(cand)) node = cand;
      else if (cand && Array.isArray(cand["@graph"])) {
        node = cand["@graph"].find(isRecipe) || node;
      }
      if (node) break;
    }
    if (node) break;
  }
  if (!node) return null;

  const stripHtml = (s) =>
    String(s || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const instructionsToLines = (v) => {
    if (!v) return [];
    if (typeof v === "string") return [stripHtml(v)];
    if (Array.isArray(v)) {
      let out = [];
      v.forEach((el) => {
        out = out.concat(instructionsToLines(el));
      });
      return out;
    }
    if (typeof v === "object") {
      if (v.itemListElement) {
        const inner = instructionsToLines(v.itemListElement);
        return v.name ? [stripHtml(v.name) + ":"].concat(inner) : inner;
      }
      if (v.text) return [stripHtml(v.text)];
      if (v.name) return [stripHtml(v.name)];
    }
    return [];
  };

  // ISO-8601-Dauer (PT1H30M) lesbar machen
  const humanDuration = (iso) => {
    const m2 = String(iso || "").match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
    if (!m2) return "";
    const parts = [];
    if (m2[1]) parts.push(m2[1] + " Tag" + (m2[1] === "1" ? "" : "e"));
    if (m2[2]) parts.push(m2[2] + " Std.");
    if (m2[3]) parts.push(m2[3] + " Min.");
    return parts.join(" ");
  };

  const firstImage = (img) => {
    if (!img) return "";
    if (typeof img === "string") return img;
    if (Array.isArray(img)) return firstImage(img[0]);
    if (typeof img === "object" && img.url) return String(img.url);
    return "";
  };

  const yieldText = Array.isArray(node.recipeYield)
    ? String(node.recipeYield[0])
    : String(node.recipeYield || "");
  const servingsMatch = yieldText.match(/\d+/);

  const steps = instructionsToLines(node.recipeInstructions);
  const numbered =
    steps.length > 1 ? steps.map((s, i) => i + 1 + ". " + s).join("\n") : steps.join("\n");

  return {
    title: stripHtml(node.name).slice(0, 250) || "Importiertes Rezept",
    description: stripHtml(node.description).slice(0, 1000),
    instructions: numbered,
    servings: servingsMatch ? parseInt(servingsMatch[0], 10) : null,
    prepTime: humanDuration(node.prepTime),
    cookTime: humanDuration(node.cookTime),
    totalTime: humanDuration(node.totalTime),
    image: firstImage(node.image),
    ingredients: (node.recipeIngredient || node.ingredients || [])
      .map(stripHtml)
      .filter(Boolean),
  };
}

module.exports = { findHouseholdByToken, extractRecipeJsonLd };
