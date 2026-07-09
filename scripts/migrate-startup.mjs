import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const JSON_PATH = path.join(__dirname, "..", "produtos-amazon.json")

const TAG_AMAZON = process.env.TAG_AMAZON ?? "titusindica-20"

export async function migrateAmazonProducts(db) {
  if (!fs.existsSync(JSON_PATH)) {
    console.log("migrate-startup: produtos-amazon.json nao encontrado, pulando")
    return 0
  }

  const dados = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"))
  const produtos = Array.isArray(dados) ? dados : [dados]
  let count = 0

  for (const p of produtos) {
    const slug = p.slug
    if (!slug) continue

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
    count++
  }

  console.log(`migrate-startup: ${count} produto(s) sincronizado(s)`)
  return count
}
