import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const QUERY = process.argv[2] ?? "mouse gamer";
const LIMITE = Number(process.argv[3] ?? 10);
const SAIDA =
  process.argv[4] ?? path.resolve(__dirname, "..", `ml-${QUERY.replace(/\s+/g, "-")}.json`);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(
  QUERY
)}&limit=${LIMITE}`;

console.log(`Buscando: ${url}`);

let dados;
try {
  const resp = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!resp.ok) {
    console.error(`Erro ${resp.status}: ${await resp.text()}`);
    process.exit(1);
  }
  dados = await resp.json();
} catch (e) {
  console.error(`Falha na requisicao: ${e.message}`);
  process.exit(1);
}

const itens = (dados.results ?? []).map((r) => ({
  ml_id: r.id,
  nome: r.title,
  preco: r.price,
  imagem_url: (r.thumbnail || "").replace("http://", "https://"),
  permalink: r.permalink,
  categoria: r.domain_id ?? null,
}));

writeFileSync(SAIDA, JSON.stringify(itens, null, 2), "utf-8");
console.log(`Salvo ${itens.length} itens em ${SAIDA}`);
console.log("Revise os itens e copie os que quiser para produtos.reais.json");