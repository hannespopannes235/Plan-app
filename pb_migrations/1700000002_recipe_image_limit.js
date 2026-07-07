/// <reference path="../pb_data/types.d.ts" />
// ============================================================================
// Plan – Größenlimit für Rezeptfotos anheben.
// iPhone-Fotos (auch die in Mela-Exporten eingebetteten) liegen oft über den
// ursprünglichen 8 MB, wodurch der Mela-Import mit "Failed to create record"
// abbrach.
// ============================================================================

migrate(
  (db) => {
    const dao = new Dao(db);
    const recipes = dao.findCollectionByNameOrId("recipes");
    const field = recipes.schema.getFieldByName("image");
    if (field) {
      field.options.maxSize = 26214400; // 25 MB
      dao.saveCollection(recipes);
    }
  },

  (db) => {
    const dao = new Dao(db);
    try {
      const recipes = dao.findCollectionByNameOrId("recipes");
      const field = recipes.schema.getFieldByName("image");
      if (field) {
        field.options.maxSize = 8388608;
        dao.saveCollection(recipes);
      }
    } catch (e) {
      /* ignore */
    }
  },
);
