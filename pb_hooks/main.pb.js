/// <reference path="../pb_data/types.d.ts" />
// ============================================================================
// Plan – Server-Logik (ersetzt die früheren Supabase-RPCs & Edge Function)
//  • POST /api/plan/redeem-invite       → Einladungs-Code einlösen
//  • GET  /ics/:token                   → abonnierbarer Kalender-Feed (.ics)
//  • POST /api/plan/shortcut/add        → Artikel per Apple-Kurzbefehl/Siri
//  • GET  /api/plan/shortcut/open       → offene Artikel (für Erinnerungen)
//  • POST /api/plan/import-recipe-url   → Rezept von Website importieren
// ============================================================================

// ---- Einladungs-Code einlösen → Mitglied werden ----------------------------
routerAdd(
  "POST",
  "/api/plan/redeem-invite",
  (c) => {
    const info = $apis.requestInfo(c);
    const user = info.authRecord;
    if (!user) throw new ForbiddenError("Nicht angemeldet.");

    const code = String((info.data && info.data.code) || "").toUpperCase().trim();
    if (!code) throw new BadRequestError("Bitte einen Einladungs-Code angeben.");

    let invite;
    try {
      invite = $app.dao().findFirstRecordByData("invites", "code", code);
    } catch (e) {
      throw new NotFoundError("Einladungs-Code ungültig.");
    }

    const expires = invite.getString("expires_at");
    if (expires && expires < new Date().toISOString()) {
      throw new BadRequestError("Dieser Einladungs-Code ist abgelaufen.");
    }

    const householdId = invite.getString("household_id");

    // Schon Mitglied? Dann nichts tun.
    let already = null;
    try {
      already = $app
        .dao()
        .findFirstRecordByFilter("household_members", "household_id = {:h} && user_id = {:u}", {
          h: householdId,
          u: user.id,
        });
    } catch (e) {
      already = null;
    }

    if (!already) {
      const col = $app.dao().findCollectionByNameOrId("household_members");
      const m = new Record(col);
      m.set("household_id", householdId);
      m.set("user_id", user.id);
      m.set("role", "member");
      $app.dao().saveRecord(m);
    }

    return c.json(200, { household_id: householdId });
  },
  $apis.requireRecordAuth(),
);

// ---- Kurzbefehle-API (Apple Shortcuts / Siri) -------------------------------
// Absicherung über das geheime ics_token des Haushalts – kein Login nötig,
// damit die Kurzbefehle einfach bleiben. Das Token kennt nur der Haushalt.
// Gemeinsame Helfer liegen in plan_utils.js (Handler laufen in isolierten
// VM-Kontexten und sehen keine Funktionen auf Dateiebene).

// Artikel zur Einkaufsliste hinzufügen.
// Body (JSON) oder Query: token, name, quantity (optional), list (optional:
// Name der Ziel-Liste; sonst die älteste Liste des Haushalts).
routerAdd("POST", "/api/plan/shortcut/add", (c) => {
  const { findHouseholdByToken } = require(`${__hooks}/plan_utils.js`);
  const info = $apis.requestInfo(c);
  const p = (key) =>
    String((info.data && info.data[key]) || c.queryParam(key) || "").trim();

  const household = findHouseholdByToken(p("token"));
  const name = p("name").slice(0, 200);
  if (!name) throw new BadRequestError("Bitte einen Artikelnamen angeben.");

  // Ziel-Liste bestimmen (benannt oder älteste); ohne Liste eine anlegen.
  const lists = $app
    .dao()
    .findRecordsByFilter("shopping_lists", "household_id = {:h}", "created", 100, 0, {
      h: household.id,
    });
  let list = null;
  const wanted = p("list").toLowerCase();
  if (wanted) {
    list = lists.find((l) => l.getString("name").toLowerCase() === wanted) || null;
    if (!list) throw new NotFoundError("Liste „" + p("list") + "“ nicht gefunden.");
  } else if (lists.length > 0) {
    list = lists[0];
  } else {
    const col = $app.dao().findCollectionByNameOrId("shopping_lists");
    list = new Record(col);
    list.set("household_id", household.id);
    list.set("name", "Einkauf");
    $app.dao().saveRecord(list);
  }

  const itemsCol = $app.dao().findCollectionByNameOrId("shopping_items");
  const item = new Record(itemsCol);
  item.set("household_id", household.id);
  item.set("list_id", list.id);
  item.set("name", name);
  item.set("quantity", p("quantity").slice(0, 50));
  item.set("is_checked", false);
  $app.dao().saveRecord(item);

  if (p("format") === "text") {
    return c.string(200, name + " → " + list.getString("name"));
  }
  return c.json(200, { ok: true, item: name, list: list.getString("name") });
});

// Offene Artikel abrufen (für den „Nach Erinnerungen übertragen"-Kurzbefehl).
// Query: token, format=json|text (Standard: json)
routerAdd("GET", "/api/plan/shortcut/open", (c) => {
  const { findHouseholdByToken } = require(`${__hooks}/plan_utils.js`);
  const household = findHouseholdByToken(String(c.queryParam("token") || "").trim());

  const items = $app
    .dao()
    .findRecordsByFilter(
      "shopping_items",
      "household_id = {:h} && is_checked = false",
      "list_id,position,created",
      500,
      0,
      { h: household.id },
    );

  const listName = {};
  $app
    .dao()
    .findRecordsByFilter("shopping_lists", "household_id = {:h}", "", 100, 0, {
      h: household.id,
    })
    .forEach((l) => {
      listName[l.id] = l.getString("name");
    });

  const rows = items.map((i) => ({
    name: i.getString("name"),
    quantity: i.getString("quantity"),
    list: listName[i.getString("list_id")] || "",
  }));

  if (String(c.queryParam("format")) === "text") {
    const lines = rows.map((r) => (r.quantity ? r.name + " (" + r.quantity + ")" : r.name));
    return c.string(200, lines.join("\n"));
  }
  return c.json(200, rows);
});

// ---- Rezept von einer Website importieren (schema.org JSON-LD) --------------
routerAdd(
  "POST",
  "/api/plan/import-recipe-url",
  (c) => {
    const { extractRecipeJsonLd } = require(`${__hooks}/plan_utils.js`);
    const info = $apis.requestInfo(c);
    const user = info.authRecord;
    if (!user) throw new ForbiddenError("Nicht angemeldet.");

    const url = String((info.data && info.data.url) || "").trim();
    const householdId = String((info.data && info.data.household_id) || "").trim();
    if (!/^https?:\/\//i.test(url)) throw new BadRequestError("Bitte einen gültigen Link angeben.");
    if (!householdId) throw new BadRequestError("household_id fehlt.");

    // Nur Mitglieder dürfen in den Haushalt importieren.
    try {
      $app
        .dao()
        .findFirstRecordByFilter("household_members", "household_id = {:h} && user_id = {:u}", {
          h: householdId,
          u: user.id,
        });
    } catch (e) {
      throw new ForbiddenError("Kein Mitglied dieses Haushalts.");
    }

    let res;
    try {
      res = $http.send({
        url: url,
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PlanApp/1.0)" },
        timeout: 20,
      });
    } catch (e) {
      throw new BadRequestError("Seite konnte nicht geladen werden.");
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new BadRequestError("Seite konnte nicht geladen werden (HTTP " + res.statusCode + ").");
    }

    const recipeData = extractRecipeJsonLd(res.raw);
    if (!recipeData) {
      throw new BadRequestError(
        "Auf dieser Seite wurden keine strukturierten Rezeptdaten gefunden.",
      );
    }

    // Rezept anlegen
    const recipesCol = $app.dao().findCollectionByNameOrId("recipes");
    const recipe = new Record(recipesCol);
    recipe.set("household_id", householdId);
    recipe.set("title", recipeData.title);
    recipe.set("description", recipeData.description);
    recipe.set("instructions", recipeData.instructions);
    recipe.set("servings", recipeData.servings || 2);
    recipe.set("link", url);
    recipe.set("prep_time", recipeData.prepTime);
    recipe.set("cook_time", recipeData.cookTime);
    recipe.set("total_time", recipeData.totalTime);
    $app.dao().saveRecord(recipe);

    // Foto (optional, Fehler ignorieren)
    if (recipeData.image) {
      try {
        const file = $filesystem.fileFromUrl(recipeData.image, 15);
        const form = new RecordUpsertForm($app, recipe);
        form.addFiles("image", file);
        form.submit();
      } catch (e) {
        /* Rezept bleibt ohne Bild */
      }
    }

    // Zutaten anlegen
    const ingsCol = $app.dao().findCollectionByNameOrId("recipe_ingredients");
    let count = 0;
    recipeData.ingredients.forEach((line) => {
      const ing = new Record(ingsCol);
      ing.set("household_id", householdId);
      ing.set("recipe_id", recipe.id);
      ing.set("name", line.slice(0, 300));
      ing.set("quantity", "");
      $app.dao().saveRecord(ing);
      count++;
    });

    return c.json(200, { id: recipe.id, title: recipeData.title, ingredients: count });
  },
  $apis.requireRecordAuth(),
);

// ---- Abonnierbarer Kalender-Feed (.ics) ------------------------------------
routerAdd("GET", "/ics/:token", (c) => {
  const token = c.pathParam("token");
  if (!token) return c.string(400, "token fehlt");

  let household;
  try {
    household = $app.dao().findFirstRecordByData("households", "ics_token", token);
  } catch (e) {
    return c.string(404, "Kalender nicht gefunden");
  }
  const hid = household.id;

  const slotLabel = { breakfast: "Frühstück", lunch: "Mittagessen", dinner: "Abendessen" };

  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  const icsDate = (s) => String(s).slice(0, 10).replace(/-/g, "");
  const nextDay = (s) => {
    const d = new Date(String(s).slice(0, 10) + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return "" + d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
  };
  const now = new Date();
  const stamp =
    "" +
    now.getUTCFullYear() +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    "T" +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds()) +
    "Z";
  const esc = (t) =>
    String(t || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");

  const events = [];
  const addEvent = (uid, date, summary, desc) => {
    if (!date) return;
    events.push(
      "BEGIN:VEVENT\r\n" +
        "UID:" + uid + "@plan-app\r\n" +
        "DTSTAMP:" + stamp + "\r\n" +
        "DTSTART;VALUE=DATE:" + icsDate(date) + "\r\n" +
        "DTEND;VALUE=DATE:" + nextDay(date) + "\r\n" +
        "SUMMARY:" + esc(summary) + "\r\n" +
        "DESCRIPTION:" + esc(desc) + "\r\n" +
        "END:VEVENT",
    );
  };

  const safeFind = (collection, filter) => {
    try {
      return $app.dao().findRecordsByFilter(collection, filter, "", 1000, 0, { h: hid });
    } catch (e) {
      return [];
    }
  };

  // Rezepttitel für Mahlzeiten vorbereiten
  const recipeTitle = {};
  safeFind("recipes", "household_id = {:h}").forEach((r) => {
    recipeTitle[r.id] = r.getString("title");
  });

  safeFind("tasks", "household_id = {:h} && due_date != ''").forEach((t) => {
    addEvent(
      "task-" + t.id,
      t.getString("due_date"),
      (t.getBool("is_done") ? "✓ " : "📋 ") + t.getString("title"),
      "Aufgabe aus Plan",
    );
  });

  safeFind("meal_plan_entries", "household_id = {:h} && date != ''").forEach((m) => {
    const title = m.getString("custom_title") || recipeTitle[m.getString("recipe_id")] || "Mahlzeit";
    addEvent(
      "meal-" + m.id,
      m.getString("date"),
      "🍽️ " + (slotLabel[m.getString("slot")] || "Essen") + ": " + title,
      "Essensplan aus Plan",
    );
  });

  safeFind("recurring_bills", "household_id = {:h} && next_due_date != ''").forEach((b) => {
    addEvent(
      "bill-" + b.id,
      b.getString("next_due_date"),
      "💶 Rechnung fällig: " + b.getString("name") + " (" + b.getFloat("amount").toFixed(2) + " €)",
      "Wiederkehrende Rechnung aus Plan",
    );
  });

  const calendar =
    "BEGIN:VCALENDAR\r\n" +
    "VERSION:2.0\r\n" +
    "PRODID:-//Plan//Haushalts-App//DE\r\n" +
    "CALSCALE:GREGORIAN\r\n" +
    "METHOD:PUBLISH\r\n" +
    "X-WR-CALNAME:Plan – " + esc(household.getString("name")) + "\r\n" +
    "X-WR-TIMEZONE:Europe/Berlin\r\n" +
    events.join("\r\n") +
    (events.length ? "\r\n" : "") +
    "END:VCALENDAR";

  c.response().header().set("Content-Type", "text/calendar; charset=utf-8");
  c.response().header().set("Cache-Control", "public, max-age=3600");
  return c.string(200, calendar);
});
