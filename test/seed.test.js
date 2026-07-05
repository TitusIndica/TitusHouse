import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestDb, getProdutoBySlug, countProdutos } from "./helper.js";
import { runSeed } from "../seed.js";

describe("seed", () => {
  let db;
  let cleanup;

  beforeEach(async () => {
    const t = await createTestDb();
    db = t.db;
    cleanup = t.cleanup;
  });

  afterEach(() => cleanup());

  it("retorna 8 produtos inseridos", async () => {
    expect(await runSeed(db)).toBe(8);
  });

  it("popula a tabela produtos com 8 linhas", async () => {
    await runSeed(db);
    expect(await countProdutos(db)).toBe(8);
  });

  it("insere o mouse com todos os campos esperados", async () => {
    await runSeed(db);
    const row = await getProdutoBySlug(db, "mouse-gamer-logitech-g203");
    expect(row.slug).toBe("mouse-gamer-logitech-g203");
    expect(row.nome).toBe("Mouse Gamer Logitech G203");
    expect(row.asin).toBe("B08L2TC2JL");
    expect(row.ml_id).toBe("MLB12345678");
    expect(row.loja_prioritaria).toBe("amazon");
    expect(row.ativo).toBe(1);
  });

  it("deixa ml_id NULL no produto headset", async () => {
    await runSeed(db);
    const row = await getProdutoBySlug(db, "headset-hyperx-cloud-2");
    expect(row.ml_id).toBe(null);
    expect(row.loja_prioritaria).toBe("amazon");
  });

  it("é idempotente: segunda chamada mantém 8 linhas", async () => {
    await runSeed(db);
    await runSeed(db);
    expect(await countProdutos(db)).toBe(8);
  });

  it("limpa linhas pré-existentes antes de semear", async () => {
    for (const slug of ["dummy-1", "dummy-2", "dummy-3"]) {
      await db.execute({
        sql: "INSERT INTO produtos (slug, nome, loja_prioritaria) VALUES (?, ?, 'amazon')",
        args: [slug, slug.toUpperCase()],
      });
    }

    await runSeed(db);

    expect(await countProdutos(db)).toBe(8);
    const { rows } = await db.execute({
      sql: "SELECT 1 FROM produtos WHERE slug = ?",
      args: ["dummy-1"],
    });
    expect(rows.length).toBe(0);
  });
});