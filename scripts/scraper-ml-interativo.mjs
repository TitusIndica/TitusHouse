import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const CAPTURADOS = new Map();

function slugify(text) {
  return text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/-+/g, "-");
}

async function capturarProdutoDaPagina(page) {
  return page.evaluate(() => {
    const url = window.location.href;
    const mlbMatch = url.match(/MLB\d{7,}/);
    if (!mlbMatch) return null;

    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";
    const ogPrice = document.querySelector('meta[property="product:price:amount"]')?.getAttribute("content") || "";
    const h1 = document.querySelector("h1")?.textContent?.trim() || "";

    const priceEl = document.querySelector('[class*="andes-money-amount__fraction"]') ||
                    document.querySelector('[data-testid="price"]');
    const priceText = ogPrice || priceEl?.textContent?.replace(/[^0-9,]/g, "").replace(",", ".") || "";

    const name = ogTitle || h1;

    return {
      ml_id: mlbMatch[0],
      nome: name || "Sem nome",
      preco: priceText ? parseFloat(priceText) : null,
      imagem_url: ogImage || null,
      url: url,
    };
  });
}

async function main() {
  console.log("=== Navegador Monitor ML ===\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "pt-BR",
  });
  const page = await ctx.newPage();

  page.on("framenavigated", async (frame) => {
    if (frame !== page.mainFrame()) return;
    const url = frame.url();
    if (!url.match(/MLB\d{7,}/)) return;

    try {
      await page.waitForTimeout(2000);
      const produto = await capturarProdutoDaPagina(page);
      if (produto && produto.ml_id && !CAPTURADOS.has(produto.ml_id)) {
        CAPTURADOS.set(produto.ml_id, produto);
        console.log(`\n[CAPTURADO] ${produto.ml_id}`);
        console.log(`   Nome: ${(produto.nome || "?").slice(0, 80)}`);
        console.log(`   Preco: R$ ${produto.preco ?? "?"}`);
        console.log(`   Total: ${CAPTURADOS.size} produtos`);
      }
    } catch (e) {
      // ignore navigation errors
    }
  });

  try {
    console.log("1. Indo pro ML...");
    await page.goto("https://www.mercadolivre.com.br/afiliados/hub", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    console.log("\n2. FAÇA LOGIN. Aguardando...");
    let logado = false;
    for (let i = 0; i < 180; i++) {
      await page.waitForTimeout(1000);
      const url = page.url();
      if (!url.includes("login") && !url.includes("auth") && !url.includes("challenges") && url.includes("mercadolivre")) {
        logado = true;
        break;
      }
      if (i % 15 === 0) process.stdout.write(".");
    }

    console.log(logado ? "\n   Login OK!" : "\n   Continuando...");

    console.log("\n" + "=".repeat(60));
    console.log("   MODO VIGILANTE ATIVO!");
    console.log("   Navegue pelo ML, visite produtos.");
    console.log("   Toda pagina com MLB ID sera capturada.");
    console.log("   Feche o navegador quando terminar.");
    console.log("=".repeat(60));

    // Wait for browser close
    await new Promise((resolve) => {
      browser.on("disconnected", resolve);
    });
  } catch (e) {
    console.error(`\nErro: ${e.message}`);
  } finally {
    console.log(`\n\nTotal capturado: ${CAPTURADOS.size} produtos`);

    if (CAPTURADOS.size > 0) {
      const paraImportar = [...CAPTURADOS.values()]
        .filter((p) => p.nome && p.nome !== "Sem nome")
        .map((p) => ({
          slug: slugify(p.nome),
          nome: p.nome,
          descricao: p.nome,
          ml_id: p.ml_id,
          asin: null,
          loja_prioritaria: "ml",
          categoria: null,
          preco: p.preco || null,
          imagem_url: p.imagem_url || null,
        }));

      const jsonPath = path.join(process.cwd(), "produtos-scraped.json");
      fs.writeFileSync(jsonPath, JSON.stringify(paraImportar, null, 2));
      console.log(`Salvo: ${jsonPath} (${paraImportar.length} produtos)`);
      console.log(`\nPra atualizar precos/imagens na vitrine:`);
      console.log(`  npm run import-ml -- update produtos-scraped.json`);
    }

    await browser.close();
    console.log("Fim.");
  }
}

await main();
