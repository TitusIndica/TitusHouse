import { chromium } from "playwright";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localPath = path.join(__dirname, "..", "data.db").replace(/\\/g, "/");
const dbUrl = process.env.TURSO_DATABASE_URL || `file:${localPath}`;
const db = createClient(
  process.env.TURSO_AUTH_TOKEN ? { url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN } : { url: dbUrl }
);

async function getPendentes() {
  const { rows } = await db.execute(
    "SELECT id, slug, nome, ml_id, preco, imagem_url, categoria FROM produtos WHERE ativo = 1 AND ml_id IS NOT NULL AND ml_id != '' ORDER BY id"
  );
  return rows.filter(p => !p.preco || !p.imagem_url);
}

async function extrair(page, mlId) {
  const url = `https://www.mercadolivre.com.br/p/${mlId}`;

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
  } catch {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
  }
  await page.waitForTimeout(2000);

  const finalUrl = page.url();
  if (finalUrl.includes("account-verification") || finalUrl.includes("login") || finalUrl.includes("challenges")) {
    return { preco: null, imagem_url: null, categoria: null, blocked: true };
  }

  return page.evaluate(() => {
    const ogImg = document.querySelector('meta[property="og:image"]')?.content || "";

    const ldScript = document.querySelector('script[type="application/ld+json"]');
    let ld = null;
    if (ldScript) {
      try { ld = JSON.parse(ldScript.textContent); } catch {}
    }

    const precoJson = ld?.offers?.price || (Array.isArray(ld?.offers) ? ld?.offers[0]?.price : null) || null;
    const primeiroPreco = document.querySelector('[class*="andes-money-amount__fraction"]')?.textContent?.replace(/[^0-9,]/g, "").replace(",", ".") || "";
    const precoDom = primeiroPreco ? parseFloat(primeiroPreco) : null;
    const preco = precoJson || precoDom || null;

    const imagem = ogImg || ld?.image || (Array.isArray(ld?.image) ? ld.image[0] : null) || "";

    const catBreadcrumb = document.querySelector('[class*="andes-breadcrumb"]');
    const cats = catBreadcrumb?.querySelectorAll("li") || [];
    const categoria = cats.length > 0 ? cats[cats.length - 1]?.textContent?.trim() : "";

    return {
      preco,
      imagem_url: imagem || null,
      categoria: categoria || null,
      blocked: false,
    };
  });
}

async function main() {
  console.log("=== Enriquecer ML ===\n");

  const pendentes = await getPendentes();
  if (pendentes.length === 0) { console.log("Todos produtos ja tem dados!"); await db.close(); return; }
  console.log(`Processando ${pendentes.length} produtos...\n`);

  console.log("Abrindo navegador...\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--window-size=1280,900"],
  });
  const ctx = await browser.newContext({ locale: "pt-BR", viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  let ok = 0;

  for (let i = 0; i < pendentes.length; i++) {
    const p = pendentes[i];
    process.stdout.write(`[${i + 1}/${pendentes.length}] ${p.ml_id}... `);

    try {
      const d = await extrair(page, p.ml_id);
      if (d.blocked) {
        console.log(`BLOQUEADO. Tentando de novo com mais tempo...`);
        await page.waitForTimeout(3000);
        const d2 = await extrair(page, p.ml_id);
        if (d2.blocked) { console.log(`   Bloqueio persiste, pulando`); continue; }
        Object.assign(d, d2);
      }
      if (d.preco || d.imagem_url || d.categoria) {
        const campos = [];
        const args = [];
        if (d.preco) { campos.push("preco = ?"); args.push(d.preco); }
        if (d.imagem_url) { campos.push("imagem_url = ?"); args.push(d.imagem_url); }
        if (d.categoria) { campos.push("categoria = ?"); args.push(d.categoria); }
        args.push(p.id);
        await db.execute({ sql: `UPDATE produtos SET ${campos.join(", ")} WHERE id = ?`, args });
        ok++;
        console.log(`OK R$ ${d.preco ?? "?"} | img ${d.imagem_url ? "sim" : "nao"} | ${d.categoria ?? "?"}`);
      } else {
        console.log("SEM DADOS");
      }
    } catch (e) {
      console.log(`ERRO: ${e.message.slice(0, 80)}`);
    }
  }

  console.log(`\n\nResumo: ${ok}/${pendentes.length} atualizados`);
  try { await browser.close(); } catch {}
  await db.close();
}

await main();
