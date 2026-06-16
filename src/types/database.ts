// Domänen-Typen für Plan. Spiegeln das SQL-Schema (supabase/migrations).

export type MemberRole = "owner" | "admin" | "member";
export type RecurrenceFreq = "none" | "daily" | "weekly" | "monthly";
export type MealSlot = "breakfast" | "lunch" | "dinner";

export interface Profile {
  id: string;
  display_name: string;
  color: string;
  avatar_emoji: string;
  created_at: string;
}

export interface Household {
  id: string;
  name: string;
  created_by: string;
  ics_token: string;
  created_at: string;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
}

export interface Invite {
  id: string;
  household_id: string;
  code: string;
  created_by: string;
  expires_at: string;
  created_at: string;
}

export interface ShoppingList {
  id: string;
  household_id: string;
  name: string;
  created_at: string;
}

export interface ShoppingItem {
  id: string;
  household_id: string;
  list_id: string;
  name: string;
  quantity: string | null;
  category: string;
  is_checked: boolean;
  checked_by: string | null;
  position: number;
  created_at: string;
}

export interface Task {
  id: string;
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
  created_at: string;
}

export interface Recipe {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  servings: number;
  created_at: string;
}

export interface RecipeIngredient {
  id: string;
  household_id: string;
  recipe_id: string;
  name: string;
  quantity: string | null;
  category: string;
  created_at: string;
}

export interface MealPlanEntry {
  id: string;
  household_id: string;
  date: string;
  slot: MealSlot;
  recipe_id: string | null;
  custom_title: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  household_id: string;
  description: string;
  amount: number;
  category: string;
  paid_by: string | null;
  date: string;
  created_at: string;
}

export interface RecurringBill {
  id: string;
  household_id: string;
  name: string;
  amount: number;
  category: string;
  recurrence: RecurrenceFreq;
  next_due_date: string;
  reminder_days: number;
  created_at: string;
}
