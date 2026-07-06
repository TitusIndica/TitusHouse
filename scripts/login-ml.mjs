import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const AUTH_FILE = path.join(process.cwd(), "ml-auth.json");

async function main() {
  console.log("=== Login ML — Salvar sessao ===\n");

  const browser = await chromium.launch({
    headless: false,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "pt-BR",
  });
  const page = await ctx.newPage();

  try {
    console.log("1. Abrindo ML...");
    console.log("   Uma janela abriu. Faca login no ML (email + senha).");
    console.log("   Resolva CAPTCHA se aparecer.");
    console.log("   O script espera ate 5 min.\n");
    await page.goto("https://www.mercadolivre.com.br/afiliados/hub", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    process.stdout.write("   Aguardando login");
    let logado = false;
    for (let i = 0; i < 300; i++) {
      await page.waitForTimeout(1000);
      try {
        const u = page.url();
        if (!u.includes("login") && !u.includes("auth") && !u.includes("challenges") && u.includes("mercadolivre")) {
          logado = true;
          break;
        }
      } catch { break; }
      if (i % 15 === 0) process.stdout.write(".");
    }

    if (!logado) {
      console.log("\n\nNao detectou login. Mesmo assim, salvando sessao atual...");
    } else {
      console.log("\n\n   Login detectado!");
    }

    await ctx.storageState({ path: AUTH_FILE });
    console.log(`   Sessao salva em: ${AUTH_FILE}`);
    console.log("\nAgora pode rodar `npm run enrich-ml` que usara a sessao salva.");

  } catch (e) {
    console.error(`\nErro: ${e.message}`);
  } finally {
    try { await browser.close(); } catch {}
  }
}

await main();
