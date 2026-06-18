/// <reference path="../pb_data/types.d.ts" />
// ============================================================================
// Plan – PocketBase Schema-Migration (entspricht der früheren Supabase-SQL-Migration)
// Wird beim Start von PocketBase automatisch angewendet.
// Collections + Zugriffsregeln (API Rules = Äquivalent zu Row Level Security).
//
// Relations-Felder heißen bewusst wie die alten SQL-Spalten (household_id,
// list_id, recipe_id, assignee_id, …), damit das Frontend kompatibel bleibt.
// ============================================================================

migrate(
  (db) => {
    const dao = new Dao(db);
    const USERS = "_pb_users_auth_"; // ID der eingebauten users-Collection

    // ---- Feld-Helfer -------------------------------------------------------
    const txt = (name, required) => ({ name, type: "text", required: !!required, options: {} });
    const num = (name) => ({ name, type: "number", required: false, options: {} });
    const bool = (name) => ({ name, type: "bool", required: false, options: {} });
    const sel = (name, values) => ({
      name,
      type: "select",
      required: false,
      options: { maxSelect: 1, values },
    });
    const rel = (name, collectionId, required, cascade) => ({
      name,
      type: "relation",
      required: !!required,
      options: {
        collectionId,
        cascadeDelete: !!cascade,
        maxSelect: 1,
        minSelect: null,
      },
    });

    // Zugriffsregel „nur Mitglieder des zugehörigen Haushalts" (für Collections
    // mit direktem household_id-Bezug). Entspricht der RLS-Policy von früher.
    const MEMBER =
      '@request.auth.id != "" && household_id.household_members_via_household_id.user_id ?= @request.auth.id';

    // ---- 1. users-Collection um Profilfelder erweitern --------------------
    const users = dao.findCollectionByNameOrId(USERS);
    const addUserField = (field) => {
      let exists = false;
      try {
        exists = !!users.schema.getFieldByName(field.name);
      } catch (e) {
        exists = false;
      }
      if (!exists) users.schema.addField(new SchemaField(field));
    };
    addUserField(txt("display_name", false));
    addUserField(txt("color", false));
    addUserField(txt("avatar_emoji", false));
    // Profile sind lesbar (Name/Farbe/Emoji), damit Mitglieder einander sehen.
    // E-Mail bleibt privat (emailVisibility=false). Leere Regel = öffentlich;
    // eine auth-pflichtige Regel würde den Login-Lookup blockieren.
    users.viewRule = "";
    users.listRule = "";
    dao.saveCollection(users);

    // ---- 2. households -----------------------------------------------------
    const households = new Collection({
      name: "households",
      type: "base",
      schema: [txt("name", true), rel("created_by", USERS, false, false), txt("ics_token", true)],
      indexes: ["CREATE UNIQUE INDEX `idx_ics_token` ON `households` (`ics_token`)"],
      listRule:
        '@request.auth.id != "" && household_members_via_household_id.user_id ?= @request.auth.id',
      viewRule:
        '@request.auth.id != "" && household_members_via_household_id.user_id ?= @request.auth.id',
      createRule: '@request.auth.id != "" && created_by = @request.auth.id',
      updateRule:
        '@request.auth.id != "" && household_members_via_household_id.user_id ?= @request.auth.id',
      deleteRule: '@request.auth.id != "" && created_by = @request.auth.id',
    });
    dao.saveCollection(households);
    const hhId = dao.findCollectionByNameOrId("households").id;

    // ---- 3. household_members ---------------------------------------------
    const members = new Collection({
      name: "household_members",
      type: "base",
      schema: [
        rel("household_id", hhId, true, true),
        rel("user_id", USERS, true, true),
        sel("role", ["owner", "admin", "member"]),
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_member_unique` ON `household_members` (`household_id`, `user_id`)",
      ],
      listRule: MEMBER,
      viewRule: MEMBER,
      // Owner darf sich selbst eintragen; Beitritt per Code läuft über den Hook
      createRule:
        '@request.auth.id != "" && user_id = @request.auth.id && household_id.created_by = @request.auth.id',
      deleteRule:
        '@request.auth.id != "" && (user_id = @request.auth.id || household_id.created_by = @request.auth.id)',
    });
    dao.saveCollection(members);

    // ---- 4. invites --------------------------------------------------------
    const invites = new Collection({
      name: "invites",
      type: "base",
      schema: [
        rel("household_id", hhId, true, true),
        txt("code", true),
        rel("created_by", USERS, false, false),
        txt("expires_at", false),
      ],
      indexes: ["CREATE UNIQUE INDEX `idx_invite_code` ON `invites` (`code`)"],
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: '@request.auth.id != "" && created_by = @request.auth.id && ' + MEMBER,
      deleteRule: MEMBER,
    });
    dao.saveCollection(invites);

    // ---- 5. shopping_lists -------------------------------------------------
    const shoppingLists = new Collection({
      name: "shopping_lists",
      type: "base",
      schema: [rel("household_id", hhId, true, true), txt("name", true)],
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: MEMBER,
      updateRule: MEMBER,
      deleteRule: MEMBER,
    });
    dao.saveCollection(shoppingLists);
    const listId = dao.findCollectionByNameOrId("shopping_lists").id;

    // ---- 6. shopping_items -------------------------------------------------
    const shoppingItems = new Collection({
      name: "shopping_items",
      type: "base",
      schema: [
        rel("household_id", hhId, true, true),
        rel("list_id", listId, true, true),
        txt("name", true),
        txt("quantity", false),
        txt("category", false),
        bool("is_checked"),
        rel("checked_by", USERS, false, false),
        num("position"),
      ],
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: MEMBER,
      updateRule: MEMBER,
      deleteRule: MEMBER,
    });
    dao.saveCollection(shoppingItems);

    // ---- 7. recipes --------------------------------------------------------
    const recipes = new Collection({
      name: "recipes",
      type: "base",
      schema: [
        rel("household_id", hhId, true, true),
        txt("title", true),
        txt("description", false),
        num("servings"),
      ],
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: MEMBER,
      updateRule: MEMBER,
      deleteRule: MEMBER,
    });
    dao.saveCollection(recipes);
    const recipeId = dao.findCollectionByNameOrId("recipes").id;

    // ---- 8. recipe_ingredients --------------------------------------------
    const recipeIngredients = new Collection({
      name: "recipe_ingredients",
      type: "base",
      schema: [
        rel("household_id", hhId, true, true),
        rel("recipe_id", recipeId, true, true),
        txt("name", true),
        txt("quantity", false),
        txt("category", false),
      ],
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: MEMBER,
      updateRule: MEMBER,
      deleteRule: MEMBER,
    });
    dao.saveCollection(recipeIngredients);

    // ---- 9. meal_plan_entries ---------------------------------------------
    const meals = new Collection({
      name: "meal_plan_entries",
      type: "base",
      schema: [
        rel("household_id", hhId, true, true),
        txt("date", false),
        sel("slot", ["breakfast", "lunch", "dinner"]),
        rel("recipe_id", recipeId, false, false),
        txt("custom_title", false),
      ],
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: MEMBER,
      updateRule: MEMBER,
      deleteRule: MEMBER,
    });
    dao.saveCollection(meals);

    // ---- 10. tasks ---------------------------------------------------------
    const tasks = new Collection({
      name: "tasks",
      type: "base",
      schema: [
        rel("household_id", hhId, true, true),
        txt("title", true),
        txt("notes", false),
        rel("assignee_id", USERS, false, false),
        txt("due_date", false),
        sel("recurrence", ["none", "daily", "weekly", "monthly"]),
        num("recurrence_interval"),
        bool("is_done"),
        txt("completed_at", false),
        rel("completed_by", USERS, false, false),
        num("points"),
      ],
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: MEMBER,
      updateRule: MEMBER,
      deleteRule: MEMBER,
    });
    dao.saveCollection(tasks);

    // ---- 11. transactions --------------------------------------------------
    const transactions = new Collection({
      name: "transactions",
      type: "base",
      schema: [
        rel("household_id", hhId, true, true),
        txt("description", true),
        num("amount"),
        txt("category", false),
        rel("paid_by", USERS, false, false),
        txt("date", false),
      ],
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: MEMBER,
      updateRule: MEMBER,
      deleteRule: MEMBER,
    });
    dao.saveCollection(transactions);

    // ---- 12. recurring_bills ----------------------------------------------
    const bills = new Collection({
      name: "recurring_bills",
      type: "base",
      schema: [
        rel("household_id", hhId, true, true),
        txt("name", true),
        num("amount"),
        txt("category", false),
        sel("recurrence", ["none", "daily", "weekly", "monthly"]),
        txt("next_due_date", false),
        num("reminder_days"),
      ],
      listRule: MEMBER,
      viewRule: MEMBER,
      createRule: MEMBER,
      updateRule: MEMBER,
      deleteRule: MEMBER,
    });
    dao.saveCollection(bills);
  },

  // ---- Revert ------------------------------------------------------------
  (db) => {
    const dao = new Dao(db);
    const names = [
      "recurring_bills",
      "transactions",
      "tasks",
      "meal_plan_entries",
      "recipe_ingredients",
      "recipes",
      "shopping_items",
      "shopping_lists",
      "invites",
      "household_members",
      "households",
    ];
    for (const n of names) {
      try {
        dao.deleteCollection(dao.findCollectionByNameOrId(n));
      } catch (e) {
        /* schon weg */
      }
    }
    // Profilfelder von users wieder entfernen
    try {
      const users = dao.findCollectionByNameOrId("_pb_users_auth_");
      ["display_name", "color", "avatar_emoji"].forEach((f) => {
        const field = users.schema.getFieldByName(f);
        if (field) users.schema.removeField(field.id);
      });
      users.viewRule = null;
      users.listRule = null;
      dao.saveCollection(users);
    } catch (e) {
      /* ignore */
    }
  },
);
