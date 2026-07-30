import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { DatabaseSync as Database } from "node:sqlite";
import dotenv from "dotenv";
import { initSchema } from "./lib/initSchema.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.SQLITE_PATH || path.join(dataDir, "app.db");

export const db = new Database(dbPath);
db.exec("PRAGMA journal_mode = WAL");

initSchema(db);
