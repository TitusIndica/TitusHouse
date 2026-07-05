import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import { createTestDb } from "./helper.js";
import { createAdminRouter } from "../routes/admin.js";

const TOKEN = "test-super-secreto-123";

function startApp(db) {
  const app = express();
  app.use(express.json());
  app.use("/admin", createAdminRouter({ db, expectedToken: TOKEN }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

function authHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "x-admin-token": TOKEN,
    ...extra,
  };
}

function url(server, p) {
  return `http://localhost:${server.address().port}/admin${p}`;
}

describe("rotas /admin/produtos", () => {
  let db;
  let server;
  let cleanup;

  beforeAll(async () => {
    const t = await createTestDb();
    db = t.db;
    cleanup = t.cleanup;
    server = await startApp(db);
  });

  afterAll(() => {
    server.close();
    cleanup();
  });

  beforeEach(async () => {
    await db.execute("DELETE FROM cliques");
    await db.execute("DELETE FROM produtos");
  });

  it("1. sem token -> 401", async () => {
    const res = await fetch(url(server, "/produtos"), {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("2. token errado -> 401", async () => {
    const res = await fetch(url(server, "/produtos"), {
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": "errado",
      },
    });
    expect(res.status).toBe(401);
  });

  it("3. GET /produtos em DB vazio -> 200 []", async () => {
    const res = await fetch(url(server, "/produtos"), {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("4. POST valido -> 201 com id, slug, ativo=1, created_at", async () => {
    const res = await fetch(url(server, "/produtos"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        slug: "a",
        nome: "A",
        asin: "B001",
        loja_prioritaria: "amazon",
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTypeOf("number");
    expect(body.slug).toBe("a");
    expect(body.nome).toBe("A");
    expect(body.asin).toBe("B001");
    expect(body.ativo).toBe(1);
    expect(body.created_at).toBeTruthy();
    const { rows } = await db.execute("SELECT COUNT(*) AS n FROM produtos");
    expect(rows[0].n).toBe(1);
  });

  it("5. POST sem slug -> 400", async () => {
    const res = await fetch(url(server, "/produtos"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ nome: "SemSlug" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "slug e nome são obrigatórios",
    });
  });

  it("6. POST com loja_prioritaria invalida -> 400", async () => {
    const res = await fetch(url(server, "/produtos"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        slug: "x",
        nome: "X",
        loja_prioritaria: "aliexpress",
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe(
      "loja_prioritaria inválida; use amazon ou ml"
    );
  });

  it("7. POST slug duplicado -> 409", async () => {
    const body1 = {
      slug: "dup",
      nome: "Dup",
      loja_prioritaria: "amazon",
    };
    const r1 = await fetch(url(server, "/produtos"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body1),
    });
    expect(r1.status).toBe(201);
    const r2 = await fetch(url(server, "/produtos"), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body1),
    });
    expect(r2.status).toBe(409);
    expect(await r2.json()).toEqual({ error: "slug já existe" });
  });

  it("8. GET /produtos/:id apos criar -> 200 completo", async () => {
    const created = await (
      await fetch(url(server, "/produtos"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          slug: "get-id",
          nome: "GetId",
          asin: "ASIN1",
          loja_prioritaria: "amazon",
        }),
      })
    ).json();
    const res = await fetch(url(server, `/produtos/${created.id}`), {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(created.id);
    expect(body.slug).toBe("get-id");
    expect(body.nome).toBe("GetId");
    expect(body.asin).toBe("ASIN1");
    expect(body.loja_prioritaria).toBe("amazon");
  });

  it("9. GET /produtos/9999 -> 404", async () => {
    const res = await fetch(url(server, "/produtos/9999"), {
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it("10. PUT parcial preserva outros campos", async () => {
    const created = await (
      await fetch(url(server, "/produtos"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          slug: "put-slug",
          nome: "Original",
          asin: "ORIG",
          loja_prioritaria: "ml",
        }),
      })
    ).json();
    const res = await fetch(url(server, `/produtos/${created.id}`), {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ nome: "Atualizado" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nome).toBe("Atualizado");
    expect(body.slug).toBe("put-slug");
    expect(body.asin).toBe("ORIG");
    expect(body.loja_prioritaria).toBe("ml");
    expect(body.id).toBe(created.id);
  });

  it("11. PUT com body vazio -> 400", async () => {
    const created = await (
      await fetch(url(server, "/produtos"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ slug: "empty-put", nome: "X" }),
      })
    ).json();
    const res = await fetch(url(server, `/produtos/${created.id}`), {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Nenhum campo para atualizar",
    });
  });

  it("12. PUT id inexistente -> 404", async () => {
    const res = await fetch(url(server, "/produtos/9999"), {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ nome: "Nada" }),
    });
    expect(res.status).toBe(404);
  });

  it("13. PUT slug duplicado de outro produto -> 409", async () => {
    const a = await (
      await fetch(url(server, "/produtos"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ slug: "outro-a", nome: "A" }),
      })
    ).json();
    const b = await (
      await fetch(url(server, "/produtos"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ slug: "outro-b", nome: "B" }),
      })
    ).json();
    const res = await fetch(url(server, `/produtos/${b.id}`), {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ slug: "outro-a" }),
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "slug já existe" });
    expect(a.id).toBeDefined();
  });

  it("14. DELETE sucesso e depois GET id -> 404", async () => {
    const created = await (
      await fetch(url(server, "/produtos"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ slug: "del-me", nome: "Del" }),
      })
    ).json();
    const res = await fetch(url(server, `/produtos/${created.id}`), {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, id: created.id });
    const getRes = await fetch(url(server, `/produtos/${created.id}`), {
      headers: authHeaders(),
    });
    expect(getRes.status).toBe(404);
  });

  it("15. DELETE id inexistente -> 404", async () => {
    const res = await fetch(url(server, "/produtos/9999"), {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });

  it("16. DELETE com clique referenciando slug -> 200 (sem FK)", async () => {
    const created = await (
      await fetch(url(server, "/produtos"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ slug: "has-clique", nome: "C" }),
      })
    ).json();
    await db.execute({
      sql: "INSERT INTO cliques (slug, loja_destino, referrer, ip_hash) VALUES (?, ?, ?, ?)",
      args: ["has-clique", "amazon", "https://t.me/x", "abc"],
    });
    const res = await fetch(url(server, `/produtos/${created.id}`), {
      method: "DELETE",
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("17. POST/PUT aceitam novos campos da vitrine (descricao, imagem_url, categoria, preco)", async () => {
    const created = await (
      await fetch(url(server, "/produtos"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          slug: "vit-prod",
          nome: "Vit",
          descricao: "mouse RGB",
          imagem_url: "https://img/x.png",
          categoria: "periféricos",
          preco: 149.9,
        }),
      })
    ).json();
    expect(created.descricao).toBe("mouse RGB");
    expect(created.imagem_url).toBe("https://img/x.png");
    expect(created.categoria).toBe("periféricos");
    expect(created.preco).toBe(149.9);

    const updated = await (
      await fetch(url(server, `/produtos/${created.id}`), {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ preco: 129.5, categoria: "mouses" }),
      })
    ).json();
    expect(updated.preco).toBe(129.5);
    expect(updated.categoria).toBe("mouses");
    expect(updated.descricao).toBe("mouse RGB");
  });
});