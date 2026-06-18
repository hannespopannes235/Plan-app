// Domänen-Typen für Plan (PocketBase-Records).
// Jeder Record hat zusätzlich die System-Felder id/created/updated.

export type MemberRole = "owner" | "admin" | "member";
export type RecurrenceFreq = "none" | "daily" | "weekly" | "monthly";
export type MealSlot = "breakfast" | "lunch" | "dinner";

export interface BaseRecord {
  id: string;
  created: string;
  updated: string;
}

/** Profil = Felder der users-Collection, die wir öffentlich anzeigen. */
export interface Profile {
  id: string;
  display_name: string;
  color: string;
  avatar_emoji: string;
}

export interface Household extends BaseRecord {
  name: string;
  created_by: string;
  ics_token: string;
}

export interface HouseholdMember extends BaseRecord {
  household_id: string;
  user_id: string;
  role: MemberRole;
}

export interface Invite extends BaseRecord {
  household_id: string;
  code: string;
  created_by: string;
  expires_at: string;
}

export interface ShoppingList extends BaseRecord {
  household_id: string;
  name: string;
}

export interface ShoppingItem extends BaseRecord {
  household_id: string;
  list_id: string;
  name: string;
  quantity: string | null;
  category: string;
  is_checked: boolean;
  checked_by: string | null;
  position: number;
}

export interface Task extends BaseRecord {
  household_id: string;
  title: string;
  notes: string | null;
  assignee_id: string | null;
  due_date: string | null;
  recurrence: RecurrenceFreq;
  recurrence_interval: number;
  is_done: boolean;
  completed_at: string | null;
  completed_by: string | null;
  points: number;
}

export interface Recipe extends BaseRecord {
  household_id: string;
  title: string;
  description: string | null;
  servings: number;
}

export interface RecipeIngredient extends BaseRecord {
  household_id: string;
  recipe_id: string;
  name: string;
  quantity: string | null;
  category: string;
}

export interface MealPlanEntry extends BaseRecord {
  household_id: string;
  date: string;
  slot: MealSlot;
  recipe_id: string | null;
  custom_title: string | null;
}

export interface Transaction extends BaseRecord {
  household_id: string;
  description: string;
  amount: number;
  category: string;
  paid_by: string | null;
  date: string;
}

export interface RecurringBill extends BaseRecord {
  household_id: string;
  name: string;
  amount: number;
  category: string;
  recurrence: RecurrenceFreq;
  next_due_date: string;
  reminder_days: number;
}
