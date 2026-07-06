import express from "express";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGoRouter } from "./routes/go.js";
import { createAdminRouter } from "./routes/admin.js";
import { createPublicRouter } from "./routes/public.js";

dotenv.config();

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em 15 minutos." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em 1 minuto." },
});

function setSecurityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  next();
}

export function createApp({ db, tags, expectedToken, webOrigin }) {
  const app = express();
  app.use(express.json());
  app.use(setSecurityHeaders);

  const allowedOrigin = webOrigin || process.env.WEB_ORIGIN || "*";
  app.use((req, res, next) => {
    if (req.method === "OPTIONS" && (req.path.startsWith("/api") || req.path.startsWith("/admin") || req.path.startsWith("/go"))) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, x-admin-token"
      );
      return res.status(204).end();
    }
    if (req.path.startsWith("/api") || req.path.startsWith("/go")) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    }
    next();
  });

  app.use("/admin", adminLimiter);
  app.use("/api", apiLimiter);
  app.use("/go", createGoRouter({ db, tags }));
  app.use("/admin", createAdminRouter({ db, expectedToken }));
  app.use("/api", createPublicRouter({ db }));
  app.get("/", (req, res) => {
    return res.redirect(301, "https://titusindica.github.io/TitusHouse-web");
  });
  app.get("/health", (req, res) => res.json({ ok: true }));

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