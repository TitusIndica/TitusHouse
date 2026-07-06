import { describe, it, expect } from "vitest";
import { buildAffiliateUrl } from "./affiliateUrl.js";

describe("buildAffiliateUrl", () => {
  it("Amazon: monta URL esperada", () => {
    const url = buildAffiliateUrl({
      loja: "amazon",
      asin: "B08X5QB8C7",
      tagAmazon: "titusindica-20",
    });
    expect(url).toBe(
      "https://www.amazon.com.br/dp/B08X5QB8C7?tag=titusindica-20",
    );
  });

  it("ML: monta URL esperada", () => {
    const url = buildAffiliateUrl({
      loja: "ml",
      ml_id: "MLB12345678",
      tagML: "123456",
    });
    expect(url).toBe(
      "https://www.mercadolivre.com.br/p/MLB12345678?mf_id=123456",
    );
  });

  it("loja desconhecida lanca erro com a mensagem correta", () => {
    expect(() =>
      buildAffiliateUrl({ loja: "mercado", asin: "X" }),
    ).toThrow("Loja desconhecida: mercado");
  });

  it("Amazon sem asin lanca erro", () => {
    expect(() =>
      buildAffiliateUrl({ loja: "amazon", tagAmazon: "t" }),
    ).toThrow();
  });

  it("Amazon sem tagAmazon lanca erro", () => {
    expect(() =>
      buildAffiliateUrl({ loja: "amazon", asin: "B08" }),
    ).toThrow();
  });

  it("Amazon: caracteres especiais no asin sao percent-encoded", () => {
    const url = buildAffiliateUrl({
      loja: "amazon",
      asin: "B0 ?&abc",
      tagAmazon: "titus-20",
    });
    expect(url).not.toContain(" ");
    expect(url).toContain("B0%20");
    expect(url).toContain("%3F");
    expect(url).toContain("%26");
    expect(url).toBe(
      "https://www.amazon.com.br/dp/B0%20%3F%26abc?tag=titus-20",
    );
  });

  it("ML: encodeURIComponent aplicado em ml_id e tagML com espacos", () => {
    const url = buildAffiliateUrl({
      loja: "ml",
      ml_id: "MLB 12 34",
      tagML: "tag com espaco",
    });
    expect(url).not.toContain(" ");
    expect(url).toContain("MLB%2012%2034");
    expect(url).toContain("mf_id=tag%20com%20espaco");
  });
});
