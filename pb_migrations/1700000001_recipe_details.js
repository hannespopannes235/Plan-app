/// <reference path="../pb_data/types.d.ts" />
// ============================================================================
// Plan – Rezepte um Details erweitern (für Mela-/URL-Import)
// Neue Felder: Zubereitung, Quell-Link, Zeiten, Bild.
// ============================================================================

migrate(
  (db) => {
    const dao = new Dao(db);
    const recipes = dao.findCollectionByNameOrId("recipes");

    const addField = (field) => {
      let exists = false;
      try {
        exists = !!recipes.schema.getFieldByName(field.name);
      } catch (e) {
        exists = false;
      }
      if (!exists) recipes.schema.addField(new SchemaField(field));
    };

    addField({ name: "instructions", type: "text", required: false, options: {} });
    addField({ name: "link", type: "text", required: false, options: {} });
    addField({ name: "prep_time", type: "text", required: false, options: {} });
    addField({ name: "cook_time", type: "text", required: false, options: {} });
    addField({ name: "total_time", type: "text", required: false, options: {} });
    addField({
      name: "image",
      type: "file",
      required: false,
      options: {
        maxSelect: 1,
        maxSize: 8388608, // 8 MB
        mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        thumbs: ["600x0"],
      },
    });

    dao.saveCollection(recipes);
  },

  (db) => {
    const dao = new Dao(db);
    try {
      const recipes = dao.findCollectionByNameOrId("recipes");
      ["instructions", "link", "prep_time", "cook_time", "total_time", "image"].forEach((name) => {
        try {
          const field = recipes.schema.getFieldByName(name);
          if (field) recipes.schema.removeField(field.id);
        } catch (e) {
          /* schon weg */
        }
      });
      dao.saveCollection(recipes);
    } catch (e) {
      /* ignore */
    }
  },
);
