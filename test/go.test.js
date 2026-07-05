import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import {
  createTestDb,
  countCliques,
  getClique,
  insertProduto,
} from "./helper.js";
import { createGoRouter } from "../routes/go.js";

function startApp(db, tags) {
  const app = express();
  app.use(
    "/go",
    createGoRouter({
      db,
      tags: tags ?? {
        tagAmazon: "titusindica-20",
        tagML: "mf123",
      },
    })
  );
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

describe("GET /go/:slug", () => {
  let db;
  let server;
  let port;
  let cleanup;

  beforeAll(async () => {
    ({ db, cleanup } = await createTestDb());
    server = await startApp(db);
    port = server.address().port;
  });

  afterAll(() => {
    server.close();
    cleanup();
  });

  it("1. redireciona para URL de afiliado da Amazon e registra clique", async () => {
    await insertProduto(db, {
      slug: "mouse-gamer",
      nome: "Mouse Gamer",
      asin: "B08L2TC2JL",
      loja_prioritaria: "amazon",
    });

    const res = await fetch(
      `http://localhost:${port}/go/mouse-gamer`,
      { redirect: "manual" }
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://www.amazon.com.br/dp/B08L2TC2JL?tag=titusindica-20"
    );
    expect(await countCliques(db, "mouse-gamer")).toBe(1);
    const clique = await getClique(db, "mouse-gamer");
    expect(clique.loja_destino).toBe("amazon");
  });

  it("2. slug desconhecido -> 404 JSON", async () => {
    const res = await fetch(`http://localhost:${port}/go/inexistente`, {
      redirect: "manual",
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Produto não encontrado" });
  });

  it("3. produto inativo -> 410 JSON e nenhum clique registrado", async () => {
    await insertProduto(db, {
      slug: "teclado-off",
      nome: "Teclado Off",
      asin: "B00INATIVO",
      loja_prioritaria: "amazon",
      ativo: 0,
    });
    const before = await countCliques(db, "teclado-off");
    const res = await fetch(`http://localhost:${port}/go/teclado-off`, {
      redirect: "manual",
    });
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "Produto inativo" });
    expect(await countCliques(db, "teclado-off")).toBe(before);
  });

  it("4. produto ML redireciona com mf_id", async () => {
    await insertProduto(db, {
      slug: "monitor-ml",
      nome: "Monitor ML",
      ml_id: "MLB98765432",
      loja_prioritaria: "ml",
    });
    const res = await fetch(`http://localhost:${port}/go/monitor-ml`, {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get("location");
    expect(loc).toContain("produto.mercadolivre.com.br/MLB98765432");
    expect(loc).toContain("mf_id=mf123");
  });

  it("5. loja desconhecida -> 500 e sem clique", async () => {
    await insertProduto(db, {
      slug: "ali-item",
      nome: "Ali Item",
      loja_prioritaria: "aliexpress",
    });
    const before = await countCliques(db, "ali-item");
    const res = await fetch(`http://localhost:${port}/go/ali-item`, {
      redirect: "manual",
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Falha ao montar URL de afiliado");
    expect(body.detalhe).toBeDefined();
    expect(await countCliques(db, "ali-item")).toBe(before);
  });

  it("6. tag ausente para a loja -> 500 e sem clique", async () => {
    const { db: db2, cleanup: cleanup2 } = await createTestDb();
    await insertProduto(db2, {
      slug: "ml-sem-tag",
      nome: "ML Sem Tag",
      ml_id: "MLB123",
      loja_prioritaria: "ml",
    });
    const server2 = await startApp(db2, {
      tagAmazon: "titusindica-20",
      tagML: undefined,
    });
    const port2 = server2.address().port;
    try {
      const res = await fetch(`http://localhost:${port2}/go/ml-sem-tag`, {
        redirect: "manual",
      });
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Falha ao montar URL de afiliado");
      expect(await countCliques(db2, "ml-sem-tag")).toBe(0);
    } finally {
      server2.close();
      cleanup2();
    }
  });

  it("7. registra referrer", async () => {
    await insertProduto(db, {
      slug: "fone-ref",
      nome: "Fone",
      asin: "B08REFERRER",
      loja_prioritaria: "amazon",
    });
    const res = await fetch(`http://localhost:${port}/go/fone-ref`, {
      redirect: "manual",
      headers: { Referer: "https://t.me/canal" },
    });
    expect(res.status).toBe(302);
    const clique = await getClique(db, "fone-ref");
    expect(clique.referrer).toBe("https://t.me/canal");
  });

  it("8. ip_hash e SHA-256 hex de 64 chars", async () => {
    await insertProduto(db, {
      slug: "monitor-ip",
      nome: "Monitor",
      asin: "B08IPHASH",
      loja_prioritaria: "amazon",
    });
    const res = await fetch(`http://localhost:${port}/go/monitor-ip`, {
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    const clique = await getClique(db, "monitor-ip");
    expect(clique.ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});