import { db } from "../db.js";

const upsertStatement = db.prepare(`
  INSERT INTO gear (id, type, name, brand, model, distance_m, is_primary, retired, updated_at)
  VALUES (@id, @type, @name, @brand, @model, @distance_m, @is_primary, @retired, CURRENT_TIMESTAMP)
  ON CONFLICT(id) DO UPDATE SET
    type = excluded.type,
    name = excluded.name,
    brand = excluded.brand,
    model = excluded.model,
    distance_m = excluded.distance_m,
    is_primary = excluded.is_primary,
    retired = excluded.retired,
    updated_at = CURRENT_TIMESTAMP
`);

export function upsertGear(gearList) {
  if (!gearList.length) return;
  db.exec("BEGIN");
  try {
    for (const gear of gearList) {
      upsertStatement.run({
        id: gear.id,
        type: gear.type,
        name: gear.name,
        brand: gear.brand ?? null,
        model: gear.model ?? null,
        distance_m: gear.distanceMeters ?? 0,
        is_primary: gear.primary ? 1 : 0,
        retired: gear.retired ? 1 : 0,
      });
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function getAllGear() {
  return db
    .prepare(`SELECT * FROM gear`)
    .all()
    .map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      brand: row.brand,
      model: row.model,
      distanceMeters: row.distance_m,
      primary: Boolean(row.is_primary),
      retired: Boolean(row.retired),
    }));
}
