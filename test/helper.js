import { createClient } from "@libsql/client";
import { rmSync } from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { tmpdir } from "node:os";

const SCHEMA = [
  `CREATE TABLE produtos (
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
    preco_original REAL,
    cupom TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`,
  `CREATE TABLE cliques (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    loja_destino TEXT NOT NULL,
    referrer TEXT,
    ip_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cliques_slug ON cliques(slug)`,
  `CREATE INDEX IF NOT EXISTS idx_cliques_created ON cliques(created_at)`,
];

export async function createTestDb() {
  const name = `titushouse-test-${crypto.randomUUID()}.db`;
  const filePath = path.join(tmpdir(), "opencode", name).replace(/\\/g, "/");
  const db = createClient({ url: `file:${filePath}` });
  await db.batch(SCHEMA);
  const cleanup = () => {
    try {
      db.close();
    } catch {}
    for (const ext of ["", "-wal", "-shm"]) {
      try {
        rmSync(filePath + ext, { force: true });
      } catch {}
    }
  };
  return { db, cleanup };
}

export async function countCliques(db, slug) {
  const { rows } = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM cliques WHERE slug = ?",
    args: [slug],
  });
  return rows[0].n;
}

export async function getClique(db, slug) {
  const { rows } = await db.execute({
    sql: "SELECT * FROM cliques WHERE slug = ? ORDER BY id DESC LIMIT 1",
    args: [slug],
  });
  return rows[0];
}

export async function insertProduto(db, p) {
  await db.execute({
    sql: "INSERT INTO produtos (slug, nome, asin, ml_id, loja_prioritaria, ativo) VALUES (?, ?, ?, ?, ?, ?)",
    args: [
      p.slug,
      p.nome,
      p.asin ?? null,
      p.ml_id ?? null,
      p.loja_prioritaria ?? "amazon",
      p.ativo ?? 1,
    ],
  });
}

export async function countProdutos(db) {
  const { rows } = await db.execute("SELECT COUNT(*) AS n FROM produtos");
  return rows[0].n;
}

export async function getProdutoBySlug(db, slug) {
  const { rows } = await db.execute({
    sql: "SELECT * FROM produtos WHERE slug = ?",
    args: [slug],
  });
  return rows[0];
}