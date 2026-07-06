import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "..", ".env");

function rl() {
  return createInterface({ input: stdin, output: stdout });
}

function ask(q) {
  const i = rl();
  return new Promise((r) => i.question(q, (a) => { i.close(); r(a.trim()); }));
}

function loadEnv() {
  if (!existsSync(ENV_PATH)) return {};
  const txt = readFileSync(ENV_PATH, "utf-8");
  const env = {};
  for (const line of txt.split("\n")) {
    const m = line.match(/^([^#=]+)=["']?(.*?)["']?$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

function saveEnv(key, value) {
  let txt = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf-8") : "";
  const re = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (re.test(txt)) {
    txt = txt.replace(re, line);
  } else {
    txt += `\n${line}`;
  }
  writeFileSync(ENV_PATH, txt, "utf-8");
  console.log(`  ${key} salvo em .env`);
}

async function testClientCredentials(clientId, clientSecret) {
  console.log("\nTestando client_credentials...");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  ERRO: ${res.status} — ${err.slice(0, 200)}`);
    return;
  }

  const data = await res.json();
  const token = data.access_token;
  console.log(`  Token obtido! expires_in=${data.expires_in}s`);

  // Testar endpoints
  console.log("\nTestando endpoints...");

  // Categorias - funciona
  const r1 = await fetch("https://api.mercadolibre.com/categories/MLB268333", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (r1.ok) {
    const cat = await r1.json();
    console.log(`  /categories/MLB268333 -> OK (${cat.name})`);
  } else {
    console.log(`  /categories -> ${r1.status}`);
  }

  // Itens - bloqueado
  const r2 = await fetch("https://api.mercadolibre.com/items/MLB1828680414", {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(`  /items/MLB1828680414 -> ${r2.status} (esperado 403 - ML bloqueou)`);

  console.log("\n--- Resumo ---");
  console.log("✅ Categorias: funciona com client_credentials");
  console.log("❌ Itens e busca: bloqueados pelo ML (403 PolicyAgent)");
  console.log("   O ML agora exige token do DONO do anuncio.");
  console.log("\nPara cadastrar produtos, use: npm run import-ml (modo manual)");
}

async function main() {
  console.log("=== Setup ML API (client_credentials) ===\n");
  console.log("Nota: o ML bloqueou acesso a itens/busca pela API.");
  console.log("Apenas o endpoint de categorias funciona.\n");

  const env = loadEnv();
  let clientId = env.ML_CLIENT_ID;
  let clientSecret = env.ML_CLIENT_SECRET;

  if (!clientId) {
    clientId = await ask("APP_ID: ");
    if (!clientId) { console.log("Cancelado."); return; }
    saveEnv("ML_CLIENT_ID", clientId);
  } else {
    console.log(`APP_ID: ${clientId}`);
  }

  if (!clientSecret) {
    clientSecret = await ask("SECRET_KEY: ");
    if (!clientSecret) { console.log("Cancelado."); return; }
    saveEnv("ML_CLIENT_SECRET", clientSecret);
  } else {
    console.log(`SECRET_KEY: ok`);
  }

  await testClientCredentials(clientId, clientSecret);
  console.log("\nSetup concluido!");
}

await main();
