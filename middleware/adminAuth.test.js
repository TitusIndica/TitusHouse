import { describe, it, expect, vi } from "vitest";
import { adminAuth } from "./adminAuth.js";

function mockReq({ headerToken, queryToken } = {}) {
  const headers = {};
  if (headerToken !== undefined) headers["x-admin-token"] = headerToken;
  const query = {};
  if (queryToken !== undefined) query.admin_token = queryToken;
  return { headers, query };
}

function mockRes() {
  const sent = {};
  const res = {
    status(c) { sent.status = c; return this; },
    json(b) { sent.body = b; return this; },
  };
  return { res, sent };
}

function mockNext() {
  return vi.fn();
}

const TOKEN = "troque-esta-string-por-uma-senha-forte-2026";

describe("adminAuth middleware", () => {
  it("1) token correto no header chama next e nao envia resposta", () => {
    const mw = adminAuth(TOKEN);
    const req = mockReq({ headerToken: TOKEN });
    const { res, sent } = mockRes();
    const next = mockNext();

    mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(sent.status).toBeUndefined();
    expect(sent.body).toBeUndefined();
  });

  it("2) token correto na query chama next", () => {
    const mw = adminAuth(TOKEN);
    const req = mockReq({ queryToken: TOKEN });
    const { res } = mockRes();
    const next = mockNext();

    mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("3) header tem precedencia quando ambos presentes e corretos", () => {
    const mw = adminAuth(TOKEN);
    const req = mockReq({ headerToken: TOKEN, queryToken: TOKEN });
    const { res } = mockRes();
    const next = mockNext();

    mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("4) ausencia de header e query retorna 401 e nao chama next", () => {
    const mw = adminAuth(TOKEN);
    const req = mockReq();
    const { res, sent } = mockRes();
    const next = mockNext();

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(sent.status).toBe(401);
    expect(sent.body).toEqual({ error: "Unauthorized" });
  });

  it("5) token errado de mesmo tamanho retorna 401 (caminho timingSafeEqual)", () => {
    const mw = adminAuth(TOKEN);
    const wrong = "x".repeat(TOKEN.length);
    const req = mockReq({ headerToken: wrong });
    const { res, sent } = mockRes();
    const next = mockNext();

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(sent.status).toBe(401);
  });

  it("6) token errado de tamanho diferente retorna 401 (sem throw)", () => {
    const mw = adminAuth(TOKEN);
    const wrong = "curto";
    const req = mockReq({ headerToken: wrong });
    const { res, sent } = mockRes();
    const next = mockNext();

    expect(() => mw(req, res, next)).not.toThrow();
    expect(next).not.toHaveBeenCalled();
    expect(sent.status).toBe(401);
  });

  it("7) token vazio no header retorna 401", () => {
    const mw = adminAuth(TOKEN);
    const req = mockReq({ headerToken: "" });
    const { res, sent } = mockRes();
    const next = mockNext();

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(sent.status).toBe(401);
  });

  it("8) adminAuth(undefined) rejeita todas as requisicoes com 401", () => {
    const mw = adminAuth(undefined);
    const req = mockReq({ headerToken: TOKEN });
    const { res, sent } = mockRes();
    const next = mockNext();

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(sent.status).toBe(401);
  });

  it("9) adminAuth('') rejeita todas as requisicoes com 401", () => {
    const mw = adminAuth("");
    const req = mockReq({ queryToken: TOKEN });
    const { res, sent } = mockRes();
    const next = mockNext();

    mw(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(sent.status).toBe(401);
  });

  it("10) status code e exatamente 401 (nao 500 nem 403) em mismatch", () => {
    const mw = adminAuth(TOKEN);
    const req = mockReq({ headerToken: "errado" });
    const { res, sent } = mockRes();
    const next = mockNext();

    mw(req, res, next);

    expect(sent.status).toBe(401);
    expect(sent.status).not.toBe(500);
    expect(sent.status).not.toBe(403);
  });
});