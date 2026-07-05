import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_URL = process.env.TITUS_API_URL ?? "https://titushouse.onrender.com";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.error("Erro: defina ADMIN_TOKEN no .env ou ambiente");
  process.exit(1);
}

const arquivo =
  process.argv[2] ?? path.resolve(__dirname, "..", "produtos.reais.json");

let produtos;
try {
  const conteudo = readFileSync(arquivo, "utf-8");
  produtos = JSON.parse(conteudo);
} catch (e) {
  console.error(`Erro ao ler ${arquivo}: ${e.message}`);
  console.error(
    "Crie produtos.reais.json baseando-se em produtos.exemplo.json, ou passe o caminho como argumento:"
  );
  console.error("  node scripts/importar-produtos.js ./meu-arquivo.json");
  process.exit(1);
}

if (!Array.isArray(produtos) || produtos.length === 0) {
  console.error("Erro: arquivo JSON deve ser um array nao-vazio de produtos");
  process.exit(1);
}

const CAMPOS_OBRIGATORIOS = ["slug", "nome"];
for (const [i, p] of produtos.entries()) {
  for (const c of CAMPOS_OBRIGATORIOS) {
    if (!p[c]) {
      console.error(`Produto #${i} sem campo obrigatorio: ${c}`);
      process.exit(1);
    }
  }
  if (p.loja_prioritaria && !["amazon", "ml"].includes(p.loja_prioritaria)) {
    console.error(
      `Produto #${i} (${p.slug}): loja_prioritaria deve ser 'amazon' ou 'ml'`
    );
    process.exit(1);
  }
}

let ok = 0;
let falha = 0;

for (const p of produtos) {
  const url = `${API_URL}/admin/produtos`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": ADMIN_TOKEN,
      },
      body: JSON.stringify(p),
    });
    const corpo = await resp.json();
    if (resp.status === 201) {
      console.log(`[OK] ${p.slug} -> id=${corpo.id}`);
      ok++;
    } else if (resp.status === 409) {
      console.log(`[SKIP] ${p.slug} ja existe (409)`);
      falha++;
    } else {
      console.log(`[ERR] ${p.slug} -> ${resp.status} ${JSON.stringify(corpo)}`);
      falha++;
    }
  } catch (e) {
    console.log(`[ERR] ${p.slug} -> ${e.message}`);
    falha++;
  }
}

console.log(`\nResumo: ${ok} inseridos, ${falha} falharam/ignorados`);