import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import dotenv from "dotenv"
import { createClient } from "@libsql/client"

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const localPath = path.join(__dirname, "data.db").replace(/\\/g, "/")
const url = process.env.TURSO_DATABASE_URL ?? `file:${localPath}`
const db = createClient(
  process.env.TURSO_AUTH_TOKEN
    ? { url, authToken: process.env.TURSO_AUTH_TOKEN }
    : { url }
)

const TAG_AMAZON = process.env.TAG_AMAZON ?? "titusindica-20"

function slugify(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80)
}

async function importarProduto(p) {
  const slug = p.slug || slugify(p.nome)
  const affiliateUrl = p.asin
    ? `https://www.amazon.com.br/dp/${p.asin}?tag=${TAG_AMAZON}`
    : null
  const bullets = p.bullets?.length ? JSON.stringify(p.bullets) : null

  await db.execute({
    sql: `INSERT OR REPLACE INTO produtos 
          (slug, nome, asin, loja_prioritaria, categoria, preco, preco_original, imagem_url, descricao, amazon_affiliate_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      slug,
      p.nome,
      p.asin ?? null,
      p.loja_prioritaria ?? "amazon",
      p.categoria ?? null,
      p.preco ?? null,
      p.preco_original ?? null,
      p.imagem_url ?? null,
      bullets,
      affiliateUrl,
    ],
  })
  return slug
}

async function main() {
  const arquivo = process.argv[2]
  if (!arquivo) {
    console.error("Uso: npm run import-amazon -- arquivo.json")
    console.error("Ex: npm run import-amazon -- produtos-amazon.json")
    process.exit(1)
  }

  const dados = JSON.parse(fs.readFileSync(arquivo, "utf-8"))
  const produtos = Array.isArray(dados) ? dados : [dados]

  for (const p of produtos) {
    const slug = await importarProduto(p)
    console.log(`✓ ${slug}`)
  }

  console.log(`\n${produtos.length} produto(s) importado(s)`)
  db.close()
}

main().catch((e) => {
  console.error("Erro:", e.message)
  process.exit(1)
})
