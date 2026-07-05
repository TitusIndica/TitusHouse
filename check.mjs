import dotenv from "dotenv";
dotenv.config();
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "data.db");
console.log("data.db existe?", fs.existsSync(dbPath), "tamanho:", fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0);

const localPath = dbPath.replace(/\\/g, "/");
const url = `file:${localPath}`;
console.log("URL:", url);

const db = createClient({ url });
await db.batch([
  `CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    categoria TEXT,
    preco REAL
  )`
]);
const t = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
console.log("tables:", t.rows.map(r => r.name));
const c = await db.execute("PRAGMA table_info(produtos)");
console.log("columns:", c.rows.map(r => r.name));
process.exit(0);