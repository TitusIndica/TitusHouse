import { createClient } from "@libsql/client";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const localPath = path.join(__dirname, "data.db").replace(/\\/g, "/");
const url = process.env.TURSO_DATABASE_URL
  || `file:${localPath}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

export const db = createClient(
  authToken ? { url, authToken } : { url }
);

await db.batch([
  `CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    asin TEXT,
    ml_id TEXT,
    loja_prioritaria TEXT NOT NULL DEFAULT 'amazon',
    ativo INTEGER NOT NULL DEFAULT 1,
    ml_affiliate_url TEXT,
    amazon_affiliate_url TEXT,
    descricao TEXT,
    imagem_url TEXT,
    categoria TEXT,
    preco REAL,
    cupom TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`,
  `CREATE TABLE IF NOT EXISTS cliques (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    loja_destino TEXT NOT NULL,
    referrer TEXT,
    ip_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cliques_slug ON cliques(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_cliques_created ON cliques(created_at)`,
]);

try {
  await db.execute("ALTER TABLE produtos ADD COLUMN cupom TEXT");
} catch {
  /* coluna ja existe — ignora */
}

export default db;