import express from "express";
import crypto from "node:crypto";
import { buildAffiliateUrl } from "../lib/affiliateUrl.js";

export function hashIp(ip) {
  if (!ip) return null;
  try {
    return crypto.createHash("sha256").update(ip).digest("hex");
  } catch {
    return null;
  }
}

export function createGoRouter({ db, tags }) {
  const router = express.Router();

  router.get("/:slug", async (req, res, next) => {
    const slug = req.params.slug;
    try {
      const { rows } = await db.execute({
        sql: "SELECT id, slug, nome, asin, ml_id, loja_prioritaria, ativo, ml_affiliate_url, amazon_affiliate_url FROM produtos WHERE slug = ?",
        args: [slug],
      });
      const produto = rows[0];

      if (!produto) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      if (produto.ativo !== 1) {
        return res.status(410).json({ error: "Produto inativo" });
      }

      let destino;
      try {
        destino = buildAffiliateUrl({
          loja: produto.loja_prioritaria,
          asin: produto.asin,
          ml_id: produto.ml_id,
          amazon_affiliate_url: produto.amazon_affiliate_url,
          ml_affiliate_url: produto.ml_affiliate_url,
          tagAmazon: tags.tagAmazon,
          tagML: tags.tagML,
        });
      } catch (e) {
        console.error("Falha ao montar URL de afiliado:", e.message);
        return res
          .status(500)
          .json({ error: "Falha ao montar URL de afiliado", detalhe: e.message });
      }

      try {
        await db.execute({
          sql: "INSERT INTO cliques (slug, loja_destino, referrer, ip_hash) VALUES (?, ?, ?, ?)",
          args: [
            produto.slug,
            produto.loja_prioritaria,
            req.get("referer") ?? null,
            hashIp(req.ip),
          ],
        });
      } catch (e) {
        console.error("Falha registro clique:", e.message);
      }

      return res.redirect(302, destino);
    } catch (e) {
      console.error("Erro em /go/:slug:", e.message);
      return res.status(500).json({ error: "Erro interno", detalhe: e.message });
    }
  });

  return router;
}