/// <reference path="../pb_data/types.d.ts" />
// ============================================================================
// Plan – Server-Logik (ersetzt die früheren Supabase-RPCs & Edge Function)
//  • POST /api/plan/redeem-invite  → Einladungs-Code einlösen
//  • GET  /ics/:token              → abonnierbarer Kalender-Feed (.ics)
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
