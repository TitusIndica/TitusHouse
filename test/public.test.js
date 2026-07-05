import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { createTestDb, insertProduto } from "./helper.js";
import { createPublicRouter } from "../routes/public.js";

function startApp(db) {
  const app = express();
  app.use(express.json());
  app.use("/api", createPublicRouter({ db }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

describe("rotas publicas /api", () => {
  let db;
  let server;
  let port;
  let cleanup;

  beforeAll(async () => {
    const t = await createTestDb();
    db = t.db;
    cleanup = t.cleanup;
    server = await startApp(db);
    port = server.address().port;
  });

  afterAll(() => {
    server.close();
    cleanup();
  });

  function api(p) {
    return `http://localhost:${port}/api${p}`;
  }

  it("1. vitrine vazia retorna 200 []", async () => {
    const res = await fetch(api("/produtos"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("2. lista produtos ativos com whitelist de campos", async () => {
    await insertProduto(db, {
      slug: "ativo-1",
      nome: "Ativo 1",
      asin: "A1",
      loja_prioritaria: "amazon",
      ativo: 1,
    });
    const res = await fetch(api("/produtos"));
    expect(res.status).toBe(200);
    const arr = await res.json();
    const row = arr.find((r) => r.slug === "ativo-1");
    expect(row).toBeDefined();
    const keys = Object.keys(row);
    expect(keys).toEqual(
      expect.arrayContaining([
        "slug",
        "nome",
        "descricao",
        "imagem_url",
        "categoria",
        "preco",
        "loja_prioritaria",
      ])
    );
    expect(keys).not.toContain("asin");
    expect(keys).not.toContain("ml_id");
    expect(keys).not.toContain("id");
    expect(keys).not.toContain("ativo");
  });

  it("3. lista ignorados produtos inativos", async () => {
    await insertProduto(db, {
      slug: "inativo-1",
      nome: "Inativo",
      loja_prioritaria: "amazon",
      ativo: 0,
    });
    const res = await fetch(api("/produtos"));
    const arr = await res.json();
    expect(arr.find((r) => r.slug === "inativo-1")).toBeUndefined();
  });

  it("4. GET /produtos/:slug ativo -> 200 com whitelist", async () => {
    await insertProduto(db, {
      slug: "single-slug",
      nome: "Single",
      loja_prioritaria: "amazon",
      ativo: 1,
    });
    const res = await fetch(api("/produtos/single-slug"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("single-slug");
    expect(body.asin).toBeUndefined();
    expect(body.ml_id).toBeUndefined();
    expect(body.ativo).toBeUndefined();
  });

  it("5. GET /produtos/:slug inativo -> 404", async () => {
    await insertProduto(db, {
      slug: "single-inativo",
      nome: "Inativo Single",
      loja_prioritaria: "amazon",
      ativo: 0,
    });
    const res = await fetch(api("/produtos/single-inativo"));
    expect(res.status).toBe(404);
  });

  it("6. GET /produtos/:slug desconhecido -> 404", async () => {
    const res = await fetch(api("/produtos/nao-existe"));
    expect(res.status).toBe(404);
  });

  it("7. GET /categorias retorna categorias distintas e ordenadas", async () => {
    await db.batch([
      { sql: "DELETE FROM produtos" },
      {
        sql: "INSERT INTO produtos (slug, nome, loja_prioritaria, categoria, ativo) VALUES ('c1', 'C1', 'amazon', 'perifericos', 1)",
      },
      {
        sql: "INSERT INTO produtos (slug, nome, loja_prioritaria, categoria, ativo) VALUES ('c2', 'C2', 'amazon', 'acessorios', 1)",
      },
      {
        sql: "INSERT INTO produtos (slug, nome, loja_prioritaria, categoria, ativo) VALUES ('c3', 'C3', 'amazon', 'perifericos', 1)",
      },
      {
        sql: "INSERT INTO produtos (slug, nome, loja_prioritaria, categoria, ativo) VALUES ('c4', 'C4', 'amazon', NULL, 1)",
      },
    ]);
    const res = await fetch(api("/categorias"));
    expect(res.status).toBe(200);
    const arr = await res.json();
    expect(arr).toEqual(["acessorios", "perifericos"]);
  });

  it("8. GET /produtos?categoria= periféricos filtra", async () => {
    const res = await fetch(api("/produtos?categoria=perifericos"));
    expect(res.status).toBe(200);
    const arr = await res.json();
    expect(arr.length).toBe(2);
    expect(arr.every((r) => r.categoria === "perifericos")).toBe(true);
  });

  it("9. lista ordenada por id DESC", async () => {
    await db.batch([
      { sql: "DELETE FROM produtos" },
      {
        sql: "INSERT INTO produtos (slug, nome, loja_prioritaria, ativo) VALUES ('ord-1', 'Ord1', 'amazon', 1)",
      },
      {
        sql: "INSERT INTO produtos (slug, nome, loja_prioritaria, ativo) VALUES ('ord-2', 'Ord2', 'amazon', 1)",
      },
      {
        sql: "INSERT INTO produtos (slug, nome, loja_prioritaria, ativo) VALUES ('ord-3', 'Ord3', 'amazon', 1)",
      },
    ]);
    const res = await fetch(api("/produtos"));
    const arr = await res.json();
    expect(arr.map((r) => r.slug)).toEqual(["ord-3", "ord-2", "ord-1"]);
  });
});