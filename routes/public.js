import express from "express";

const PUBLIC_COLS =
  "slug, nome, descricao, imagem_url, categoria, preco, loja_prioritaria";

export function createPublicRouter({ db }) {
  const router = express.Router();

  router.get("/produtos", async (req, res, next) => {
    try {
      const categoria = req.query.categoria;
      let result;
      if (categoria) {
        result = await db.execute({
          sql: `SELECT ${PUBLIC_COLS} FROM produtos WHERE ativo = 1 AND categoria = ? ORDER BY id DESC`,
          args: [categoria],
        });
      } else {
        result = await db.execute(
          `SELECT ${PUBLIC_COLS} FROM produtos WHERE ativo = 1 ORDER BY id DESC`
        );
      }
      return res.status(200).json(result.rows);
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Erro interno", detalhe: e.message });
    }
  });

  router.get("/produtos/:slug", async (req, res, next) => {
    try {
      const { rows } = await db.execute({
        sql: `SELECT ${PUBLIC_COLS} FROM produtos WHERE slug = ? AND ativo = 1`,
        args: [req.params.slug],
      });
      if (rows.length === 0) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }
      return res.status(200).json(rows[0]);
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Erro interno", detalhe: e.message });
    }
  });

  router.get("/categorias", async (req, res, next) => {
    try {
      const { rows } = await db.execute(
        "SELECT DISTINCT categoria FROM produtos WHERE categoria IS NOT NULL ORDER BY categoria"
      );
      return res.status(200).json(rows.map((r) => r.categoria));
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Erro interno", detalhe: e.message });
    }
  });

  return router;
}