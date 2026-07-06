import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

function slugify(text) {
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/-+/g, "-");
}

async function extractMLB(page) {
  return page.evaluate(() => {
    const results = [];
    const html = document.documentElement.innerHTML;
    const mlbMatches = html.match(/MLB\d{7,}/g) || [];
    [...new Set(mlbMatches)].forEach((mlb) => {
      if (!results.some((r) => r.ml_id === mlb))
        results.push({ ml_id: mlb, nome: "", href: "" });
    });
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href") || "";
      const mlb = href.match(/MLB\d{7,}/);
      if (mlb) {
        const existing = results.find((r) => r.ml_id === mlb[0]);
        if (existing) {
          if (!existing.nome) existing.nome = a.textContent?.trim()?.slice(0, 100) || "";
          if (!existing.href) existing.href = href;
        } else {
          results.push({
            ml_id: mlb[0],
            nome: a.textContent?.trim()?.slice(0, 100) || "",
            href,
          });
        }
      }
    });
    return results;
  });
}

async function visitHubPage(page, url, name) {
  console.log(`\n--- ${name} ---`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log(`   URL: ${page.url()}`);
  await page.screenshot({ path: `hub-${name}.png`, fullPage: true });

  const mlbs = await extractMLB(page);
  if (mlbs.length > 0) {
    console.log(`   MLB IDs: ${mlbs.map((m) => m.ml_id).join(", ")}`);
    mlbs.forEach((m) => console.log(`      ${m.ml_id}: ${m.nome.slice(0, 80)}`));
  } else {
    console.log(`   Nenhum MLB.`);
  }
  return mlbs;
}

async function main() {
  console.log("=== Explorer ML Hub (login manual) ===\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "pt-BR",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  try {
    console.log("1. Abrindo hub de afiliados...");
    await page.goto("https://www.mercadolivre.com.br/afiliados/hub", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    console.log(`   URL: ${page.url()}`);

    console.log("\n2. FAÇA LOGIN MANUALMENTE no navegador aberto.");
    console.log("   Resolva CAPTCHA se aparecer.");
    console.log("   Aguardando ate 3 minutos...\n");

    let logado = false;
    for (let i = 0; i < 180; i++) {
      await page.waitForTimeout(1000);
      const url = page.url();
      if (url.includes("hub") || url.includes("afiliados")) {
        if (!url.includes("login") && !url.includes("auth") && !url.includes("challenges")) {
          logado = true;
          console.log(`   Login detectado! URL: ${url.slice(0, 100)}`);
          break;
        }
      }
      if (i % 15 === 0) console.log(`   Aguardando... (${i + 1}s)`);
    }

    if (!logado) {
      console.log("   Timeout. Verificando ultima URL...");
      console.log(`   URL final: ${page.url()}`);
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: "hub-pos-login.png", fullPage: true });

    // Try hub pages
    const allMLBs = new Map();
    const hubsToVisit = [
      "https://www.mercadolivre.com.br/afiliados/hub",
      "https://www.mercadolivre.com.br/afiliados/hub/links",
      "https://www.mercadolivre.com.br/afiliados/hub/mis-links",
      "https://www.mercadolivre.com.br/afiliados/hub/products",
      "https://www.mercadolivre.com.br/afiliados/hub/listas",
      "https://www.mercadolivre.com.br/afiliados/hub/dashboard",
    ];

    for (const url of hubsToVisit) {
      const mlbs = await visitHubPage(page, url, url.split("/").pop() || "hub");
      mlbs.forEach((m) => allMLBs.set(m.ml_id, m));
    }

    // Also try profile
    console.log(`\n--- Perfil social ---`);
    await page.goto("https://www.mercadolivre.com.br/social/solu2851438", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: "hub-perfil.png", fullPage: true });
    const mlbsPerfil = await extractMLB(page);
    mlbsPerfil.forEach((m) => allMLBs.set(m.ml_id, m));

    console.log("\n\n=== RESULTADO ===");
    if (allMLBs.size === 0) {
      console.log("Nenhum MLB ID encontrado.");
      console.log("O hub nao mostra produtos com MLB ID visivel.");
      console.log("\nAlternativa: me mande URLs de produtos do ML pra cadastrar manualmente.");
    } else {
      console.log(`${allMLBs.size} produto(s):`);
      const paraImportar = [];
      for (const [mlb, data] of allMLBs) {
        console.log(`   ${mlb}: ${data.nome || "(sem nome)"}`);
        if (data.nome && data.nome !== mlb) {
          paraImportar.push({
            slug: slugify(data.nome),
            nome: data.nome,
            descricao: data.nome,
            ml_id: mlb,
            asin: null,
            loja_prioritaria: "ml",
            categoria: null,
            preco: null,
            imagem_url: null,
          });
        }
      }
      if (paraImportar.length > 0) {
        const jsonPath = path.join(process.cwd(), "produtos-scraped.json");
        fs.writeFileSync(jsonPath, JSON.stringify(paraImportar, null, 2));
        console.log(`\nJSON: ${jsonPath}`);
        console.log(`Importar: npm run import-ml -- json produtos-scraped.json`);
      }
    }

    console.log("\nNavegador aberto pra analise. Fecha manualmente ou aguarda 30s...");
    await page.waitForTimeout(30000);
  } catch (e) {
    console.error(`\nErro: ${e.message}`);
    try { await page.screenshot({ path: "hub-erro.png" }); } catch {}
  } finally {
    await browser.close();
    console.log("Fim.");
  }
}

await main();
