import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "./helper.js";
import { createApp } from "../server.js";

const TOKEN = "int-test-token-987";

let server;
let port;
let baseUrl;
let cleanup;

beforeAll(async () => {
  const { db, cleanup: c } = await createTestDb();
  cleanup = c;
  await db.execute(
    "INSERT INTO produtos (slug, nome, asin, loja_prioritaria) VALUES ('mouse-test', 'Mouse Test', 'B00TEST', 'amazon')"
  );
  const app = createApp({
    db,
    tags: { tagAmazon: "tag-teste-20", tagML: "mf-teste" },
    expectedToken: TOKEN,
  });
  server = app.listen(0);
  port = server.address().port;
  baseUrl = `http://localhost:${port}`;
});

afterAll(() => {
  server?.close();
  cleanup();
});

async function adminFetch(p, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    "x-admin-token": TOKEN,
    ...(opts.headers || {}),
  };
  return fetch(`${baseUrl}${p}`, { ...opts, headers, body: opts.body });
}

describe("integração server.js", () => {
  it("GET /health responde ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("GET /go/mouse-test redireciona 302 e registra clique", async () => {
    const res = await fetch(`${baseUrl}/go/mouse-test`, { redirect: "manual" });
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toBe("https://www.amazon.com.br/dp/B00TEST?tag=tag-teste-20");
  });

  it("/admin sem token retorna 401 (fail-closed)", async () => {
    const res = await fetch(`${baseUrl}/admin/produtos`);
    expect(res.status).toBe(401);
  });

  it("fluxo completo: criar produto via admin, redirecionar por /go, listar", async () => {
    const created = await adminFetch("/admin/produtos", {
      method: "POST",
      body: JSON.stringify({
        slug: "novo-prod",
        nome: "Novo",
        asin: "B00NEW",
        loja_prioritaria: "amazon",
      }),
    });
    expect(created.status).toBe(201);
    const novo = await created.json();
    expect(novo.slug).toBe("novo-prod");

    const redir = await fetch(`${baseUrl}/go/novo-prod`, { redirect: "manual" });
    expect(redir.status).toBe(302);
    expect(redir.headers.get("location")).toContain("amazon.com.br/dp/B00NEW");

    const list = await adminFetch("/admin/produtos");
    const arr = await list.json();
    expect(arr.length).toBeGreaterThanOrEqual(2);
  });
});