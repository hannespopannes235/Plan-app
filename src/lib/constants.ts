import type { MealSlot, RecurrenceFreq } from "@/types/database";

// Auswahlfarben für Mitglieder-Avatare
export const MEMBER_COLORS = [
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#84cc16", // lime
  "#f97316", // orange
  "#64748b", // slate
];

export const AVATAR_EMOJIS = [
  "🙂", "😎", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁",
  "🐸", "🐧", "🦉", "🐝", "🌻", "🌵", "🍀", "⭐",
];

// Einkaufs-Kategorien (für Gruppierung)
export const SHOPPING_CATEGORIES = [
  "Obst & Gemüse",
  "Backwaren",
  "Molkereiprodukte",
  "Fleisch & Fisch",
  "Tiefkühl",
  "Getränke",
  "Vorrat",
  "Süßes & Snacks",
  "Haushalt",
  "Drogerie",
  "Sonstiges",
] as const;

export const EXPENSE_CATEGORIES = [
  "Lebensmittel",
  "Miete",
  "Fixkosten",
  "Haushalt",
  "Freizeit",
  "Transport",
  "Gesundheit",
  "Sonstiges",
] as const;

// Farben für Diagramme (Recharts)
export const CATEGORY_COLORS: Record<string, string> = {
  Lebensmittel: "#10b981",
  Miete: "#3b82f6",
  Fixkosten: "#8b5cf6",
  Haushalt: "#f59e0b",
  Freizeit: "#ec4899",
  Transport: "#06b6d4",
  Gesundheit: "#ef4444",
  Sonstiges: "#64748b",
};

export const CHART_PALETTE = [
  "#f59e0b", "#10b981", "#3b82f6", "#ec4899",
  "#8b5cf6", "#06b6d4", "#ef4444", "#84cc16",
];

export const RECURRENCE_LABELS: Record<RecurrenceFreq, string> = {
  none: "Einmalig",
  daily: "Täglich",
  weekly: "Wöchentlich",
  monthly: "Monatlich",
};

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Frühstück",
  lunch: "Mittagessen",
  dinner: "Abendessen",
};

export const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
