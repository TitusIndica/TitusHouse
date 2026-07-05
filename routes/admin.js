import express from "express";
import { adminAuth } from "../middleware/adminAuth.js";

const LOJAS_VALIDAS = ["amazon", "ml"];
const CAMPOS_ATUALIZAVEIS = [
  "slug",
  "nome",
  "asin",
  "ml_id",
  "loja_prioritaria",
  "ativo",
  "descricao",
  "imagem_url",
  "categoria",
  "preco",
];

const SELECT_COLS =
  "id, slug, nome, asin, ml_id, loja_prioritaria, ativo, descricao, imagem_url, categoria, preco, created_at";

function isUniqueError(err) {
  return (
    err?.code === "SQLITE_CONSTRAINT_UNIQUE" ||
    err?.code === "SQLITE_CONSTRAINT" ||
    (err?.message && err.message.includes("UNIQUE"))
  );
}

export function createAdminRouter({ db, expectedToken }) {
  const router = express.Router();
  router.use(adminAuth(expectedToken));

  router.get("/produtos", async (req, res, next) => {
    try {
      const { rows } = await db.execute(
        `SELECT ${SELECT_COLS} FROM produtos ORDER BY id`
      );
      return res.status(200).json(rows);
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Erro interno", detalhe: e.message });
    }
  });

  router.get("/produtos/:id", async (req, res, next) => {
    try {
      const { rows } = await db.execute({
        sql: `SELECT ${SELECT_COLS} FROM produtos WHERE id = ?`,
        args: [req.params.id],
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

  router.post("/produtos", async (req, res, next) => {
    try {
      const body = req.body ?? {};

      if (!body.slug || !body.nome) {
        return res
          .status(400)
          .json({ error: "slug e nome são obrigatórios" });
      }

      if (
        body.loja_prioritaria !== undefined &&
        !LOJAS_VALIDAS.includes(body.loja_prioritaria)
      ) {
        return res.status(400).json({
          error: "loja_prioritaria inválida; use amazon ou ml",
        });
      }

      let ativo = 1;
      if (body.ativo !== undefined) {
        if (body.ativo !== 0 && body.ativo !== 1) {
          return res
            .status(400)
            .json({ error: "ativo deve ser 0 ou 1" });
        }
        ativo = body.ativo;
      }

      const lojaPrioritaria = body.loja_prioritaria ?? "amazon";

      try {
        const info = await db.execute({
          sql: "INSERT INTO produtos (slug, nome, asin, ml_id, loja_prioritaria, ativo, descricao, imagem_url, categoria, preco) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          args: [
            body.slug,
            body.nome,
            body.asin ?? null,
            body.ml_id ?? null,
            lojaPrioritaria,
            ativo,
            body.descricao ?? null,
            body.imagem_url ?? null,
            body.categoria ?? null,
            body.preco ?? null,
          ],
        });

        const { rows } = await db.execute({
          sql: `SELECT ${SELECT_COLS} FROM produtos WHERE id = ?`,
          args: [Number(info.lastInsertRowid)],
        });

        return res.status(201).json(rows[0]);
      } catch (insertErr) {
        if (isUniqueError(insertErr)) {
          return res.status(409).json({ error: "slug já existe" });
        }
        throw insertErr;
      }
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Erro interno", detalhe: e.message });
    }
  });

  router.put("/produtos/:id", async (req, res, next) => {
    try {
      const body = req.body ?? {};

      const { rows } = await db.execute({
        sql: `SELECT ${SELECT_COLS} FROM produtos WHERE id = ?`,
        args: [req.params.id],
      });
      const existente = rows[0];
      if (!existente) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      const campos = [];
      const valores = [];
      for (const campo of CAMPOS_ATUALIZAVEIS) {
        if (body[campo] !== undefined) {
          if (campo === "loja_prioritaria" && !LOJAS_VALIDAS.includes(body[campo])) {
            return res.status(400).json({
              error: "loja_prioritaria inválida; use amazon ou ml",
            });
          }
          if (campo === "ativo" && body[campo] !== 0 && body[campo] !== 1) {
            return res
              .status(400)
              .json({ error: "ativo deve ser 0 ou 1" });
          }
          campos.push(`${campo} = ?`);
          valores.push(body[campo]);
        }
      }

      if (campos.length === 0) {
        return res
          .status(400)
          .json({ error: "Nenhum campo para atualizar" });
      }

      valores.push(req.params.id);

      try {
        await db.execute({
          sql: `UPDATE produtos SET ${campos.join(", ")} WHERE id = ?`,
          args: valores,
        });
      } catch (updateErr) {
        if (isUniqueError(updateErr)) {
          return res.status(409).json({ error: "slug já existe" });
        }
        throw updateErr;
      }

      const { rows: updated } = await db.execute({
        sql: `SELECT ${SELECT_COLS} FROM produtos WHERE id = ?`,
        args: [req.params.id],
      });
      return res.status(200).json(updated[0]);
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Erro interno", detalhe: e.message });
    }
  });

  router.delete("/produtos/:id", async (req, res, next) => {
    try {
      const { rows } = await db.execute({
        sql: "SELECT id FROM produtos WHERE id = ?",
        args: [req.params.id],
      });
      if (rows.length === 0) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      await db.execute({
        sql: "DELETE FROM produtos WHERE id = ?",
        args: [req.params.id],
      });
      return res.status(200).json({ ok: true, id: Number(req.params.id) });
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Erro interno", detalhe: e.message });
    }
  });

  return router;
}