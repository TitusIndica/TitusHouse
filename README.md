# TitusHouse — Hub de Ofertas Amazon

Hub de redirecionamento de links de afiliado Amazon com vitrine pública.

## Stack

| Camada | Tecnologia | Deploy |
|--------|-----------|--------|
| Backend | Node.js 24+, Express 4, Turso (SQLite) | [Render](https://titushouse.onrender.com) |
| Frontend | Next.js 16, React 19, Tailwind 4 | [Vercel](https://titushouse-next.vercel.app) |
| Database | Turso (libsql) | `libsql://titushouse-luizpauloqa.aws-us-east-2.turso.io` |

## Estrutura

```
TitusHouse/              ← Backend (este repositório)
├── server.js            ← Entrypoint Express
├── db.js                ← Conexão Turso + schema
├── routes/              ← go.js, admin.js, public.js
├── middleware/           ← adminAuth.js
├── lib/                 ← affiliateUrl.js, ml-api.js
├── scripts/             ← Scraping ML, importação
├── produtos-amazon.json ← Seed de produtos Amazon
├── seed.js              ← Popula catálogo inicial
├── test/                ← 63 testes Vitest
├── .env.example         ← Template de variáveis
└── AGENTS.md            ← Doc de arquitetura completa

titushouse-next/         ← Frontend (repositório separado)
└── https://github.com/TitusIndica/titushouse-next
```

## Comandos

```bash
npm start              # Produção (node server.js)
npm run dev            # Dev com hot reload (node --watch server.js)
npm run seed           # Popular catálogo do produtos-amazon.json
npm test               # Vitest (63 testes)
npm run import-ml      # CLI interativo para importar produtos ML
npm run enrich-ml      # Playwright — captura preços/imagens dos produtos ML
npm run scraper-ml     # Extrai MLB IDs do hub ML (login manual)
```

## API

### Rotas públicas

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/produtos` | Lista produtos (paginação, filtro por categoria) |
| `GET` | `/api/produtos/grupos` | Produtos agrupados por categoria |
| `GET` | `/api/produtos/:slug` | Detalhe de produto |
| `GET` | `/api/categorias` | Lista de categorias |
| `GET` | `/go/:slug` | Redirect de afiliado (302) com tag injetada |
| `POST` | `/api/curator` | Busca inteligente no catálogo |

### Rotas admin (protegidas por `x-admin-token`)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/admin/produtos` | Lista todos produtos |
| `GET` | `/admin/produtos/:id` | Detalhe por ID |
| `POST` | `/admin/produtos` | Criar produto |
| `PUT` | `/admin/produtos/:id` | Atualizar produto |
| `DELETE` | `/admin/produtos/:id` | Excluir produto |

## Schema

### `produtos`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INTEGER PK | Auto-increment |
| `slug` | TEXT UNIQUE | Identificador URL |
| `nome` | TEXT NOT NULL | Nome do produto |
| `asin` | TEXT | Amazon Standard Identification Number |
| `loja_prioritaria` | TEXT | `amazon` ou `ml` |
| `ativo` | INTEGER | 0 ou 1 |
| `descricao` | TEXT | JSON array de bullets |
| `imagem_url` | TEXT | URL da imagem no CDN Amazon |
| `categoria` | TEXT | Categoria do produto |
| `preco` | REAL | Preço atual |
| `preco_original` | REAL | Preço original (para desconto) |
| `cupom` | TEXT | Código de cupom |
| `created_at` | TEXT | Data de criação |

### `cliques`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INTEGER PK | Auto-increment |
| `slug` | TEXT | Produto clicado |
| `loja_destino` | TEXT | Amazon ou ML |
| `referrer` | TEXT | Origem do clique |
| `ip_hash` | TEXT | IP hasheado (SHA-256 + salt) |
| `created_at` | TEXT | Data do clique |

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `TAG_AMAZON` | Tag de afiliado Amazon Associates |
| `TAG_ML` | Tag de afiliado Mercado Livre |
| `ADMIN_TOKEN` | Token de acesso ao `/admin` |
| `TURSO_DATABASE_URL` | URL do banco Turso (vazio = SQLite local) |
| `TURSO_AUTH_TOKEN` | Token de auth do Turso |
| `WEB_ORIGIN` | Origem permitida no CORS |
| `PORT` | Porta do servidor (Render injeta automático) |
| `IP_HASH_SALT` | Salt para hash de IP |

## Deploy

Render free tier — hiberna após 15 min inativo. Auto-deploy no push para `main`.

Banco Turso persistente entre restarts.

## Testes

63 testes Vitest cobrindo: server, affiliate URLs, admin auth, CRUD, redirects, API pública.
