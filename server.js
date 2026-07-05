import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGoRouter } from "./routes/go.js";
import { createAdminRouter } from "./routes/admin.js";
import { createPublicRouter } from "./routes/public.js";

dotenv.config();

export function createApp({ db, tags, expectedToken, webOrigin }) {
  const app = express();
  app.use(express.json());

  const allowedOrigin = webOrigin || process.env.WEB_ORIGIN || "*";
  app.use((req, res, next) => {
    if (req.method === "OPTIONS" && req.path.startsWith("/api")) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
      );
      return res.status(204).end();
    }
    if (req.path.startsWith("/api")) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    }
    next();
  });

  app.use("/go", createGoRouter({ db, tags }));
  app.use("/admin", createAdminRouter({ db, expectedToken }));
  app.use("/api", createPublicRouter({ db }));
  app.get("/health", (req, res) => res.json({ ok: true, webOrigin: process.env.WEB_ORIGIN || null }));

  app.use((req, res) => {
    return res.status(404).json({ error: "Rota não encontrada" });
  });

  app.use((err, req, res, next) => {
    console.error("Erro não tratado:", err.message);
    return res.status(500).json({ error: "Erro interno" });
  });

  return app;
}

const isMain =
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const db = (await import("./db.js")).default;
  const app = createApp({
    db,
    tags: {
      tagAmazon: process.env.TAG_AMAZON,
      tagML: process.env.TAG_ML,
    },
    expectedToken: process.env.ADMIN_TOKEN,
    webOrigin: process.env.WEB_ORIGIN,
  });
  const port = process.env.PORT ?? 3000;
  app.listen(port, () => console.log(`TitusHouse rodando na porta ${port} (WEB_ORIGIN="${process.env.WEB_ORIGIN || "(não definido)"}")`));
}