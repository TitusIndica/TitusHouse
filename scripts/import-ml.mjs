import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@libsql/client";
import { gerarSlug } from "../lib/ml-api.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localPath = path.join(__dirname, "..", "data.db").replace(/\\/g, "/");
const url = process.env.TURSO_DATABASE_URL || `file:${localPath}`;
const db = createClient(
  process.env.TURSO_AUTH_TOKEN ? { url, authToken: process.env.TURSO_AUTH_TOKEN } : { url }
);

function rl() {
  return createInterface({ input: stdin, output: stdout });
}

function perguntar(prompt) {
  const i = rl();
  return new Promise((resolve) => i.question(prompt, (r) => { i.close(); resolve(r.trim()); }));
}

async function importarProduto(produto) {
  const info = await db.execute({
    sql: "INSERT INTO produtos (slug, nome, descricao, asin, ml_id, loja_prioritaria, categoria, preco, imagem_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args: [
      produto.slug, produto.nome, produto.descricao ?? produto.nome,
      produto.asin ?? null, produto.ml_id ?? null, produto.loja_prioritaria ?? "ml",
      produto.categoria ?? null, produto.preco ?? null, produto.imagem_url ?? null,
    ],
  });
  return Number(info.lastInsertRowid);
}

async function atualizarProduto(produto) {
  const campos = [];
  const valores = [];
  for (const campo of ["nome", "descricao", "preco", "imagem_url", "categoria", "slug"]) {
    if (produto[campo] !== undefined && produto[campo] !== null) {
      campos.push(`${campo} = ?`);
      valores.push(produto[campo]);
    }
  }
  if (campos.length === 0) return null;
  valores.push(produto.ml_id);
  const info = await db.execute({
    sql: `UPDATE produtos SET ${campos.join(", ")} WHERE ml_id = ?`,
    args: valores,
  });
  return Number(info.rowsAffected);
}

async function fluxoManual() {
  console.log("\n--- Novo Produto (manual) ---");

  const nome = await perguntar("Nome: ");
  if (!nome) { console.log("Cancelado."); return; }

  let slug = gerarSlug(nome);
  const slugInput = await perguntar(`Slug [${slug}]: `);
  if (slugInput) slug = slugInput;

  const mlId = await perguntar("MLB ID (ex: MLB12345678): ");
  const asin = await perguntar("ASIN Amazon (opcional): ");
  const loja = (await perguntar("Loja prioritaria [ml] (ml/amazon): ")) || "ml";
  const precoRaw = await perguntar("Preco (opcional): ");
  const preco = precoRaw ? parseFloat(precoRaw.replace(",", ".")) : null;
  const categoria = await perguntar("Categoria (opcional): ");
  const imagem = await perguntar("URL da imagem (opcional): ");
  const descricao = await perguntar("Descricao (opcional): ");

  const produto = {
    slug,
    nome,
    descricao: descricao || nome,
    ml_id: mlId || null,
    asin: asin || null,
    loja_prioritaria: loja,
    preco,
    categoria: categoria || null,
    imagem_url: imagem || null,
  };

  console.log("\n--- Resumo ---");
  console.log(`  Nome:      ${produto.nome}`);
  console.log(`  Slug:      ${produto.slug}`);
  console.log(`  ML ID:     ${produto.ml_id}`);
  console.log(`  ASIN:      ${produto.asin}`);
  console.log(`  Loja:      ${produto.loja_prioritaria}`);
  console.log(`  Preco:     ${produto.preco ? `R$ ${produto.preco.toFixed(2)}` : "n/d"}`);
  console.log(`  Categoria: ${produto.categoria || "n/d"}`);

  const conf = await perguntar("\nImportar? (s/N): ");
  if (conf.toLowerCase() !== "s") { console.log("Cancelado."); return; }

  try {
    const id = await importarProduto(produto);
    console.log(`  OK — ID ${id}`);
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT" || e.message?.includes("UNIQUE")) {
      console.log(`  SKIP — slug "${produto.slug}" ja existe`);
    } else {
      throw e;
    }
  }
}

async function fluxoJSON() {
  const arquivo = await perguntar("Caminho do arquivo JSON: ");
  if (!arquivo) { console.log("Cancelado."); return; }
  const json = JSON.parse(fs.readFileSync(arquivo.trim(), "utf-8"));
  const lista = Array.isArray(json) ? json : [json];

  console.log(`\nImportando ${lista.length} produto(s)...`);
  let ok = 0, skip = 0;
  for (const p of lista) {
    if (!p.slug && p.nome) p.slug = gerarSlug(p.nome);
    try {
      await importarProduto(p);
      ok++;
    } catch (e) {
      if (e.code === "SQLITE_CONSTRAINT" || e.message?.includes("UNIQUE")) {
        console.log(`  SKIP — "${p.slug}" ja existe`);
        skip++;
      } else {
        console.error(`  ERRO — ${p.slug}: ${e.message}`);
      }
    }
  }
  console.log(`\nFeito: ${ok} importados, ${skip} ignorados`);
}

async function fluxoUpdateJSON(arquivo) {
  const json = JSON.parse(fs.readFileSync(arquivo, "utf-8"));
  const lista = Array.isArray(json) ? json : [json].filter((p) => p.ml_id);
  if (lista.length === 0) { console.log("Nenhum produto com ml_id no JSON."); return; }

  console.log(`Atualizando ${lista.length} produto(s) por ml_id...`);
  let ok = 0, skip = 0;
  for (const p of lista) {
    if (!p.ml_id) { skip++; continue; }
    if (!p.preco && !p.imagem_url && !p.categoria) { skip++; continue; }
    const afetados = await atualizarProduto(p);
    if (afetados && afetados > 0) { ok++; }
    else { skip++; }
  }
  console.log(`Feito: ${ok} atualizados, ${skip} ignorados`);
}

async function fluxoSeed() {
  const { runSeed } = await import("../seed.js");
  const n = await runSeed(db);
  console.log(`Seed concluido: ${n} produtos inseridos/recriados`);
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || "";

  try {
    if (cmd === "json" && args[1]) {
      const lista = JSON.parse(fs.readFileSync(args[1], "utf-8"));
      const arr = Array.isArray(lista) ? lista : [lista];
      let ok = 0, skip = 0;
      for (const p of arr) {
        if (!p.slug && p.nome) p.slug = gerarSlug(p.nome);
        try { await importarProduto(p); ok++; }
        catch (e) {
          if (e.code === "SQLITE_CONSTRAINT" || e.message?.includes("UNIQUE")) { skip++; }
          else { console.error(`ERRO ${p.slug}: ${e.message}`); }
        }
      }
      console.log(`Importados: ${ok}, ignorados: ${skip}`);
    } else if (cmd === "seed") {
      await fluxoSeed();
    } else if (cmd === "update" && args[1]) {
      await fluxoUpdateJSON(args[1]);
    } else {
      console.log("=== Importador TitusHouse ===\n");
      const modo = await perguntar(
        "[m] Manual\n" +
        "[j] JSON (importar)\n" +
        "[u] JSON (atualizar precos/imagens)\n" +
        "[s] Seed (recriar catalogo)\n" +
        "[q] Sair\n" +
        "Escolha: "
      );

      switch (modo.toLowerCase()) {
        case "m": await fluxoManual(); break;
        case "j": await fluxoJSON(); break;
        case "u": {
          const f = await perguntar("Caminho do JSON: ");
          if (f) await fluxoUpdateJSON(f);
          break;
        }
        case "s": await fluxoSeed(); break;
        default: console.log("Ate logo!");
      }
    }
  } catch (e) {
    console.error("Erro:", e.message);
  } finally {
    try { await db.close(); } catch {}
  }
}

await main();
