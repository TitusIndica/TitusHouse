# AGENTS.md — TitusHouse

Hub de redirecionamento de links de afiliado (Amazon, ML) com vitrine pública (`/api`). Node.js + Express + Turso (`@libsql/client`, SQLite-compatible) + dotenv, ESM assíncrono.

## Status

Backend completo (migrado do better-sqlite3 síncrono para o `@libsql/client` assíncrono em v2.0.0). 63/63 testes passando em `vitest@4` (7 arquivos: `lib/affiliateUrl`, `middleware/adminAuth`, `test/seed`, `test/go`, `test/server`, `test/admin`, `test/public`). Handlers de rota agora `async`; queries via `db.execute({ sql, args })` (retorna `{ rows }`) e `db.batch([stmts])` para transações. Sem lint, typecheck ou build configurados. `engines.node >=24` declarado em `package.json`. Sem `NODE_ENV` gateando respostas de erro — `detalhe: e.message` exposto em 500 (aceitável enquanto projeto não tem usuários; gatear quando SaaS/multi-usuário).

## Comandos

- `npm start` → `node server.js` (produção)
- `npm run dev` → `node --watch server.js` (hot reload nativo)
- `npm run seed` → `node seed.js` (popular catálogo)
- `npm run import-ml` → `node scripts/import-ml.mjs` (CLI interativo para cadastrar produtos)
  - Modo manual `[m]`: preenche campo a campo
  - Modo JSON `[j]`: `npm run import-ml -- json arquivo.json` (importa lote)
  - Modo update `[u]`: `npm run import-ml -- update arquivo.json` (atualiza preco/imagem/ml_id existentes)
  - Modo seed `[s]`: `npm run import-ml -- seed` (recria catálogo do seed.js)
- `npm run scraper-ml` → `node scripts/scraper-ml-playwright.mjs` (extrai MLB IDs do hub ML com login manual)
- `npm run scraper-ml-live` → `node scripts/scraper-ml-interativo.mjs` (monitor interativo: navega e captura precos/imagens)
- `npm run enrich-ml` → `node scripts/enrich-ml-automatico.mjs` (visita automaticamente TODOS os produtos ML no navegador, captura precos/imagens e salva no banco)
- `npm run setup-ml` → `node scripts/setup-ml-oauth.mjs` (testa endpoints da API ML)
- `npm test` → `vitest run` (suíte de testes, single run)
- `npm run test:watch` → `vitest` (watch mode)

### Extração de dados ML

ML bloqueia acesso programático: API retorna 403 (PolicyAgent), HTTP scraping redireciona pra `account-verification`, login automatizado detectado como bot. Abordagens que funcionam:

**1. Extrair MLB IDs do hub (`npm run scraper-ml`):**
- Abre navegador Playwright no hub de afiliados
- Usuário faz login manualmente (resolve CAPTCHA se aparecer)
- Script extrai MLB IDs e nomes da grid de produtos
- Salva em `produtos-scraped.json`

**2. Capturar precos/imagens:**

Opção A — Automático (`npm run enrich-ml`):
- Abre navegador, usuário faz login 1x
- Script visita automaticamente TODAS as páginas dos produtos cadastrados
- Captura preco, imagem e categoria de cada um
- Já salva direto no banco (UPDATE)

Opção B — Manual (`npm run scraper-ml-live`):
- Abre navegador Playwright em modo vigilante
- Usuário faz login, depois navega livremente pelos produtos ML
- Toda página com MLB ID é capturada automaticamente (preco, imagem, nome via meta tags)
- Ao fechar o navegador, salva em `produtos-scraped.json`

**3. Atualizar banco com dados capturados:**
```bash
npm run import-ml -- update produtos-scraped.json
```
Atualiza `preco`, `imagem_url`, `categoria` dos produtos existentes (match por `ml_id`).

**Modo manual (alternativa):**
1. Acesse o produto no ML, copie MLB ID
2. `npm run import-ml`, modo `[m]`, preencha campos
3. Ou use `npm run import-ml -- json arquivo.json` para importar lote

### Setup ML API (`npm run setup-ml`)

Script em `scripts/setup-ml-oauth.mjs` que:
- Lê/coleta `ML_CLIENT_ID` e `ML_CLIENT_SECRET`
- Testa `client_credentials` (app-level token, sem refresh)
- Mostra quais endpoints funcionam (categorias ✅, itens/busca ❌)

Roda sem dependências extras (Node 24+ nativo).

Sem lint, typecheck ou build configurados. Não inventar comandos. Stack requer **Node 24+** (`engines.node` declarado em `package.json`; better-sqlite3 12 compila nativamente; 11.x falha em Node 24).

## Config / env

- Copiar `.env.example` → `.env` antes de rodar.
- Variáveis: `TAG_AMAZON`, `TAG_ML`, `ADMIN_TOKEN` (auth do `/admin`), `TURSO_DATABASE_URL` (vazio em dev cai para `file:./data.db` local), `TURSO_AUTH_TOKEN` (só para Turso remoto), `WEB_ORIGIN` (origem permitida no CORS do `/api`), `PORT` (default 3000; Render injeta `PORT` automaticamente). `SQLITE_PATH` foi **removido** em v2.0.0 — substituído por `TURSO_DATABASE_URL`.
- `dotenv.config()` roda em `db.js` e em `server.js` (server.js lê `WEB_ORIGIN`/`ADMIN_TOKEN`/`TAG_*` no entrypoint). `seed.js` importa `db.js` e herda o dotenv.
- `db.js` resolve o arquivo SQLite local relativo a `db.js` (não ao CWD) quando `TURSO_DATABASE_URL` ausente. Schema criado com `db.batch([...])` no import de `db.js` (top-level await).
- `db.js` usa o idiom ESM `path.dirname(fileURLToPath(import.meta.url))` para obter `__dirname`.

## Schema (definido em db.js)

- `produtos`: `id` (PK AUTOINCREMENT), `slug` (UNIQUE NOT NULL), `nome` (NOT NULL), `asin`, `ml_id`, `loja_prioritaria` (NOT NULL DEFAULT `amazon`), `ativo` (NOT NULL DEFAULT 1), `ml_affiliate_url` (escape hatch, normalmente NULL), `amazon_affiliate_url` (escape hatch, normalmente NULL), `descricao` (vitrine), `imagem_url` (vitrine), `categoria` (vitrine), `preco` REAL (vitrine), `created_at` (DEFAULT `datetime('now','localtime')`).
- `cliques`: `id` (PK AUTOINCREMENT), `slug` (NOT NULL), `loja_destino` (NOT NULL), `referrer`, `ip_hash`, `created_at` (DEFAULT `datetime('now','localtime')`).
- **Testes que criam schema manualmente** (em `test/`) precisam declarar TODAS as colunas acima incluindo `ml_affiliate_url`, `amazon_affiliate_url`, `descricao`, `imagem_url`, `categoria`, `preco`. Helper central em `test/helper.js` (`createTestDb`) já inclui tudo — reusar em novos testes.
- Índices em `cliques`: `idx_cliques_slug` (slug), `idx_cliques_created` (created_at). Sem índice em `produtos.slug` além da UNIQUE implicit index.
- Tabelas criadas com `CREATE TABLE IF NOT EXISTS` no import de `db.js` — schema evolui junto com o código, sem sistema de migrations separado. Ao alterar colunas, tratar manualmente (sem `ALTER TABLE` automático).

## Escopo arquitetural

Backend serve JSON/redirects + API pública para a vitrine (frontend separado, tipicamente GitHub Pages). `package.json` não declara lib de UI.

Consequências para o código:
- `server.js` serve só JSON/redirects, sem templates HTML. Handlers 404 e de erro globais retornam JSON.
- `/admin` é protegido por `ADMIN_TOKEN` via `middleware/adminAuth.js` (timingSafeEqual, fail-closed).
- `/api/*` (rotas públicas em `routes/public.js`) **sem auth** e com `Access-Control-Allow-Origin` setado para `WEB_ORIGIN` (ou `*` em dev). A vitrine consome esses endpoints.
- CORS implementado inline em `server.js` (sem dep de `cors`); preflight `OPTIONS /api*` responde 204.
- Se frontend for adicionado futuramente: **separar responsabilidades** — frontend próprio (repo/diretório distinto) consumindo API REST do backend; não acoplar view engine ao Express.
- Responsabilidade atual do backend: (1) resolver `slug` → URL de afiliado, (2) registrar clique em `cliques`, (3) expor `/admin` para CRUD de `produtos`, (4) expor `/api` (público, read-only) para a vitrine.

## Deploy

Render free tier (Node web service). Hiberna após 15min inativo (UptimeRobot mencionado no plano). Sem CNPJ necessário.

**Persistência (v2.0.0):** `@libsql/client` permite usar Turso remoto (`TURSO_DATABASE_URL` libsql://...) para preservar dados entre restarts do Render. Em dev/teste, `file:./data.db` local continua funcionando. Setar `TURSO_AUTH_TOKEN` no Render só quando usar Turso remoto.

## Pre-commit

`.gitignore` existe e cobre `.env`, `data.db*`, `node_modules/`. Antes de qualquer commit, confirmar que `git status` não lista `.env` nem `data.db*` como unstaged. Ver também `skills/secret-scanning` na tabela abaixo.

## @libsql/client no Express (substitui better-sqlite3 em v2.0.0)

`@libsql/client` é **assíncrono** — `db.execute({ sql, args })` retorna Promise `{ rows, columns, rowsAffected, lastInsertRowid }`. `db.batch([...stmts])` executa transação. Diferenças importantes vs better-sqlite3:
- `lastInsertRowid` vem como **BigInt** (`2n`) — use `Number(info.lastInsertRowid)` ao repassar para SQL/JSON.
- Erro de UNIQUE: `err.code === "SQLITE_CONSTRAINT"` (sem sufixo `_UNIQUE`); confiar também em `err.message.includes("UNIQUE")`.
- Schema de testes: `@libsql/client` **não suporta** `memory://`. Helper em `test/helper.js` gera um `file:<tmpdir>/opencode/test-<uuid>.db` por suite e apaga no `afterAll/afterEach`.
- Aviso: `db.close()` pode deixar locks/EPERM no Windows; o helper envolve cleanup em `try/catch` e tenta remover `-wal`/`-shm` também.

## Convenções

- Código em PT-BR para nomes de tabelas/colunas/identificadores de domínio (`produtos`, `cliques`, `loja_prioritaria`).
- `PLANO_PASSO_A_PASSO.md` é o roadmap do projeto — descreve fases de cadastro, hospedagem e catálogo. Não é código nem doc técnica; conflita eventualmente com a realidade do código — confiar no código primeiro.

## Skills e instruções de referência

Mapeamento da stack do TitusHouse para recursos verificados em `../awesome-copilot/`. Usar como fonte de especificações ao tocar cada parte.

| Parte | Recurso (relativo a `awesome-copilot/`) | Quando aplicar |
|---|---|---|
| Node.js ESM (server.js, seed.js, db.js) | `instructions/nodejs-javascript-vitest.instructions.md` (`applyTo: **/*.js, **/*.mjs, **/*.cjs`) | Antes de criar `server.js`/`seed.js`: ESM Node 20+, async/await, evitar deps novas sem perguntar, `undefined` em vez de `null` |
| Express / rotas `/go/:slug` e `/admin` | `skills/security-review/SKILL.md` + `instructions/security-and-owasp.instructions.md` (`applyTo: **`) | Auth do `/admin` (A01 broken access control), proteção contra open-redirect em `/go/:slug`, validação de input, rate-limit |
| better-sqlite3 / schema / queries | `skills/sql-code-review/SKILL.md` + `skills/sql-optimization/SKILL.md` | Queries parametrizadas (slug vem da URL → risco de injection se concatenado), revisar índices de `cliques` para relatórios por data |
| `.env` / ADMIN_TOKEN / tags de afiliado | `skills/secret-scanning/SKILL.md` + `skills/security-review/SKILL.md` | Antes de commit: `.env` real nunca entra no repo (só `.env.example`); verificar hardcoded secrets; validar push protection |
| Teste do fluxo de redirect local | `skills/webapp-testing/SKILL.md` | Subir `npm run dev` e validar via Playwright: 302 → URL final com tag de afiliado injetada, registro em `cliques` |
| URL de afiliado / query string | `instructions/security-and-owasp.instructions.md` (A05 injection, A08 integrity) | Construção da URL de destino: sanitizar `asin`/`ml_id`, usar `encodeURIComponent`, não confiar no `referrer` |

Notas:
- Recursos do `awesome-copilot` são **documentos de referência**, não auto-aplicados no opencode: `SKILL.md` e `.instructions.md` (mesmo com `applyTo`) são só textos a consultar manualmente ao tocar a parte correspondente.
- Nenhuma skill cobre Render deploy especificamente; seguir o `PLANO_PASSO_A_PASSO.md` FASE 2 e o free-tier (hiberna em 15min, UptimeRobot opcional).