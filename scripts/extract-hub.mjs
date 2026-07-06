import { chromium } from "playwright";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";

dotenv.config();

const AUTH_FILE = path.join(process.cwd(), "ml-auth.json");
const localPath = path.join(import.meta.dirname, "..", "data.db").replace(/\\/g, "/");
const dbUrl = process.env.TURSO_DATABASE_URL || `file:${localPath}`;
const db = createClient(
  process.env.TURSO_AUTH_TOKEN ? { url: dbUrl, authToken: process.env.TURSO_AUTH_TOKEN } : { url: dbUrl }
);

async function main() {
  console.log("=== Extrair dados do Hub ML ===\n");

  if (!fs.existsSync(AUTH_FILE)) {
    console.log("Primeiro rode: npm run login-ml (login 1x pra salvar sessao)");
    await db.close();
    return;
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "pt-BR",
    storageState: AUTH_FILE,
  });
  const page = await ctx.newPage();

  try {
    // 1. Go to hub page
    console.log("1. Acessando hub de produtos...");
    await page.goto("https://www.mercadolivre.com.br/afiliados/hub/mis-productos", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    const urlAtual = page.url();
    if (urlAtual.includes("login") || urlAtual.includes("auth") || urlAtual.includes("challenges")) {
      console.log("   Sessao expirou. Rode npm run login-ml de novo.");
      await browser.close();
      await db.close();
      return;
    }
    console.log("   OK - Hub carregado!");

    // 2. Try to extract product cards from the page
    console.log("2. Extraindo dados...");
    const produtos = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll("a[href*='MLB'], div[class*='product'], div[class*='card'], tr, li[class*='product']");
      return { totalCards: cards.length, html: document.body.innerHTML.substring(0, 5000) };
    });

    console.log(`   Cards encontrados: ${produtos.totalCards}`);
    console.log(`   HTML preview: ${produtos.html.substring(0, 1000)}`);

    // 3. Try different extraction strategies
    const data = await page.evaluate(() => {
      const items = [];

      // Strategy 1: Look for product links with MLB IDs
      const links = document.querySelectorAll("a[href*='MLB']");
      links.forEach(a => {
        const mlbMatch = a.href.match(/MLB\d{7,}/);
        if (mlbMatch) {
          const card = a.closest("div, li, tr, article") || a.parentElement;
          const img = card?.querySelector("img")?.src || "";
          const nome = card?.querySelector("h2, h3, h4, strong, span[class*='title'], p")?.textContent?.trim() || a.textContent?.trim() || "";
          const priceEl = card?.querySelector('[class*="price"], [class*="andes-money"], [class*="amount"]');
          const price = priceEl?.textContent?.trim() || "";
          items.push({ ml_id: mlbMatch[0], nome, preco_raw: price, imagem: img });
        }
      });

      if (items.length === 0) {
        // Strategy 2: Look for product table rows
        const rows = document.querySelectorAll("tr");
        rows.forEach(row => {
          const text = row.textContent || "";
          const mlbMatch = text.match(/MLB\d{7,}/);
          if (mlbMatch) {
            const img = row.querySelector("img")?.src || "";
            const cells = row.querySelectorAll("td");
            items.push({ ml_id: mlbMatch[0], html: row.innerHTML.substring(0, 500) });
          }
        });
      }

      if (items.length === 0) {
        // Strategy 3: Search entire text for MLB IDs and surrounding content
        const body = document.body.innerHTML;
        const mlbRegex = /MLB\d{7,}/g;
        let match;
        while ((match = mlbRegex.exec(body)) !== null) {
          const start = Math.max(0, match.index - 200);
          const end = Math.min(body.length, match.index + 200);
          items.push({ ml_id: match[0], context: body.substring(start, end) });
        }
      }

      return items;
    });

    console.log(`\n   Produtos extraidos: ${data.length}`);
    data.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.ml_id} - ${(p.nome || p.preco_raw || "").substring(0, 60)} ${p.imagem ? " [img]" : ""}`);
    });

    // If we got useful data, save it
    if (data.length > 0) {
      const comDados = data.filter(p => p.nome || p.preco_raw || p.imagem);
      if (comDados.length > 0) {
        fs.writeFileSync("hub-extract.json", JSON.stringify(comDados, null, 2));
        console.log(`\n   Salvo: hub-extract.json`);
      }
    }

    // 4. Take a screenshot to see what the page looks like
    await page.screenshot({ path: "hub-screenshot.png", fullPage: true });
    console.log("\n   Screenshot salvo: hub-screenshot.png");

    // 5. Also try to find JSON data in the page source
    const pageSource = await page.content();
    const jsonMatches = pageSource.match(/window\.__PRELOADED_STATE__\s*=\s*({.*?});/s) ||
                        pageSource.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s) ||
                        pageSource.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>({.*?})<\/script>/s);

    if (jsonMatches) {
      fs.writeFileSync("hub-preload.json", jsonMatches[1]);
      console.log("   Dados pre-carregados salvos: hub-preload.json");
    }

  } catch (e) {
    console.error(`\nErro: ${e.message}`);
  } finally {
    try { await browser.close(); } catch {}
    await db.close();
  }
}

await main();
