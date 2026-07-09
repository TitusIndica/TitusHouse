import express from "express";

const PUBLIC_COLS =
  "slug, nome, asin, descricao, imagem_url, categoria, preco, preco_original, loja_prioritaria, cupom";

export function createPublicRouter({ db }) {
  const router = express.Router();

  router.get("/produtos", async (req, res, next) => {
    try {
      const categoria = req.query.categoria;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
      const offset = (page - 1) * limit;

      const where = ["ativo = 1"];
      const args = [];
      if (categoria) {
        where.push("categoria = ?");
        args.push(categoria);
      }
      const whereClause = where.join(" AND ");

      const [{ rows: countRows }, { rows }] = await db.batch([
        { sql: `SELECT COUNT(*) as total FROM produtos WHERE ${whereClause}`, args },
        { sql: `SELECT ${PUBLIC_COLS} FROM produtos WHERE ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`, args: [...args, limit, offset] },
      ]);

      const total = Number(countRows[0].total);
      const pages = Math.max(1, Math.ceil(total / limit));

      return res.status(200).json({
        data: rows,
        total,
        page,
        pages,
        limit,
      });
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Erro interno" });
    }
  });

  router.get("/produtos/grupos", async (req, res, next) => {
    try {
      const { rows } = await db.execute(
        `SELECT ${PUBLIC_COLS} FROM produtos WHERE ativo = 1 ORDER BY categoria, id DESC`
      );
      const grupos = {};
      for (const row of rows) {
        const cat = row.categoria || "Outros";
        if (!grupos[cat]) grupos[cat] = [];
        grupos[cat].push(row);
      }
      return res.status(200).json(grupos);
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Erro interno" });
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
        .json({ error: "Erro interno" });
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
        .json({ error: "Erro interno" });
    }
  });

  return router;
}
