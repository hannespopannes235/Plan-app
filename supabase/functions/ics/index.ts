// ============================================================================
// Edge Function: ics
// Liefert pro Haushalt einen abonnierbaren iCalendar-Feed (.ics).
// Aufruf:  /functions/v1/ics?token=<ics_token>
// In Google/Apple Kalender als "Kalender abonnieren" / "per URL" eintragen.
// ----------------------------------------------------------------------------
// Verwendet den Service-Role-Key, da Kalender-Clients keinen Login mitschicken.
// Zugriff wird über das geheime, pro Haushalt zufällige ics_token abgesichert.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// Datum (ganztägig) → YYYYMMDD
function toICSDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function stamp(): string {
  const d = new Date();
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function vevent(opts: {
  uid: string;
  date: string;
  summary: string;
  description?: string;
}): string {
  return [
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${stamp()}`,
    `DTSTART;VALUE=DATE:${toICSDate(opts.date)}`,
    `DTEND;VALUE=DATE:${nextDay(opts.date)}`,
    `SUMMARY:${escapeText(opts.summary)}`,
    opts.description ? `DESCRIPTION:${escapeText(opts.description)}` : "",
    "END:VEVENT",
  ]
    .filter(Boolean)
    .join("\r\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return new Response("token fehlt", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: household, error } = await supabase
    .from("households")
    .select("id, name")
    .eq("ics_token", token)
    .maybeSingle();

  if (error || !household) {
    return new Response("Kalender nicht gefunden", { status: 404, headers: corsHeaders });
  }

  const hid = household.id;

  const [tasksRes, mealsRes, billsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_date, is_done")
      .eq("household_id", hid)
      .not("due_date", "is", null),
    supabase
      .from("meal_plan_entries")
      .select("id, date, slot, custom_title, recipes(title)")
      .eq("household_id", hid),
    supabase
      .from("recurring_bills")
      .select("id, name, amount, next_due_date")
      .eq("household_id", hid),
  ]);

  const events: string[] = [];

  const slotLabel: Record<string, string> = {
    breakfast: "Frühstück",
    lunch: "Mittagessen",
    dinner: "Abendessen",
  };

  for (const t of tasksRes.data ?? []) {
    if (!t.due_date) continue;
    events.push(
      vevent({
        uid: `task-${t.id}@plan-app`,
        date: t.due_date,
        summary: `${t.is_done ? "✓ " : "📋 "}${t.title}`,
        description: "Aufgabe aus Plan",
      }),
    );
  }

  for (const m of mealsRes.data ?? []) {
    const title = m.custom_title ?? (m.recipes as { title?: string } | null)?.title ?? "Mahlzeit";
    events.push(
      vevent({
        uid: `meal-${m.id}@plan-app`,
        date: m.date,
        summary: `🍽️ ${slotLabel[m.slot] ?? "Essen"}: ${title}`,
        description: "Essensplan aus Plan",
      }),
    );
  }

  for (const b of billsRes.data ?? []) {
    events.push(
      vevent({
        uid: `bill-${b.id}@plan-app`,
        date: b.next_due_date,
        summary: `💶 Rechnung fällig: ${b.name} (${Number(b.amount).toFixed(2)} €)`,
        description: "Wiederkehrende Rechnung aus Plan",
      }),
    );
  }

  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Plan//Haushalts-App//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Plan – ${escapeText(household.name)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(calendar, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="plan.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
});
