# PLANO PASSO A PASSO — Hub de Afiliados Tech/Games

Projeto: TitusHouse
Objetivo: Hub pessoal de redirecionamento de links de afiliado (Amazon, ML)
Stack: Node.js + Express + Turso + Render (gratis, sem CNPJ)
Nicho: Tecnologia / Games

---

## FASE 1 — Cadastros nos 2 programas de afiliado (dia 1-3)

### 1.1 — Amazon Associates
**URL:** https://associados.amazon.com.br

**O que preencher:**
- CPF, nome, email, telefone, endereco
- Site/blog/rede social onde vai divulgar (pode usar URL do hub: `seu-hub.onrender.com`)
- Descricao do tipo de conteudo

**Anotar:**
- [ ] Tag de afiliado (ex: `seunome-20`) -> vai no `.env` como `TAG_AMAZON`
- [ ] Login/senha do painel

**Atencao:**
- Amazon exige 3 vendas em 180 dias ou perde a conta
- Periodo de aprovacao de 180 dias
- Proibido usar link em email spam, grupos WhatsApp nao opt-in, anuncios adulto

### 1.2 — Mercado Livre Parceiros
**URL:** https://parceiros.mercadolivre.com.br

**O que preencher:**
- CPF, email, dados bancarios
- Tipo de site/canal
- Descricao do conteudo

**Anotar:**
- [ ] mf_id (ID de parceiro) -> `.env` como `TAG_ML`
- [ ] Login/senha

**Atencao:**
- Comissao por categoria varia (eletronicos 1-3%, moda 6-8%)
- Maioria de produtos comuns funciona com CPF (sem CNPJ)

---

## FASE 2 — Hospedagem e dominio (dia 2)

### 2.1 — Conta no Render.com
**URL:** https://render.com

**Criar:**
- [ ] Conta gratuita (login com GitHub ou email)
- [ ] NAO criar o service ainda (so depois do codigo pronto)

### 2.2 — Conta no GitHub
**URL:** https://github.com

**Criar (quando for codar):**
- [ ] Repositorio `TitusHouse`
- [ ] Repositorio `TitusHouse-web` (publico, para GitHub Pages)
- [ ] Anotar usuario/senha

### 2.3 — Conta Turso (banco de dados persistente)
**URL:** https://turso.tech

**Criar:**
- [ ] Conta gratuita
- [ ] Database `titushouse` (regiao Sao Paulo)
- [ ] Anotar `TURSO_DATABASE_URL` (libsql://...) e `TURSO_AUTH_TOKEN`

### 2.4 — (Opcional) Dominio proprio
- [ ] Registro.br — `.com.br` R$40/ano (opcional)
- [ ] Ou use `seu-hub.onrender.com` gratis e migre depois

---

## FASE 3 — Canais de divulgacao (dia 2-3)

### Opcao A (recomendada): Canal Telegram
1. [ ] Abrir Telegram -> "Novo Canal"
2. [ ] Nome: ex "Ofertas Tech Games"
3. [ ] Tipo: Publico
4. [ ] Anotar @username_do_canal
5. [ ] Bio com disclaimer de afiliado

### Opcao B (depois): Conta Instagram-nicho
@achadinhos_techgames etc.

### Opcao C (depois da codificacao): Bot Telegram via BotFather
So crie o canal agora. O bot e depois.

---

## FASE 4 — Estrutura de dados — Catalogo (dia 3-5)

Reuna 10 produtos tech/games reais. Para cada produto colete:

| Campo | Exemplo | Onde achar |
|---|---|---|
| Nome | "Mouse Gamer Logitech G203" | Loja |
| Slug | `mouse-gamer-logitech-g203` | Voce inventa |
| ASIN (Amazon) | B08L2XXX | URL: `amazon.com.br/dp/B08L2XXX` |
| ML_ID | MLB12345678 | URL do ML: `/MLB12345678-titulo` |
| Loja prioritaria | `amazon` | Voce decide (tabela comissao) |
| Preco atual | R$ 149,90 | Cada loja |

### Onde achar a tabela de comissao:
- Amazon: painel Associates -> "Taxas de comissao" (1-12%)
- ML: painel -> "Categorias e comissoes"

### Como cadastrar produtos reais no hub (sem inventar dados)

O `seed.js` popula o banco com 8 produtos DEMO (ASIN/ML_ID ficticios) — serve
pra vitrine nao ficar vazia e pra testes passarem. **Nao sao produtos reais.**

Para inserir produtos reais usando a API admin:

1. Copie `produtos.exemplo.json` -> `produtos.reais.json` (ja no .gitignore)
2. Para cada produto real preencha:
   - `slug` ( unico, em kebab-case )
   - `nome`
   - `asin` (Amazon) ou `ml_id` (Mercado Livre)
   - `loja_prioritaria` (`"amazon"` ou `"ml"`)
   - `categoria`, `preco`, `imagem_url`, `descricao`
3. Rode: `node scripts/importar-produtos.js`
   - Le o `.env` do projeto (`ADMIN_TOKEN` + `TITUS_API_URL` se diferente do padrao)
   - POST cada produto para `/admin/produtos` no backend em producao
   - Pula duplicatas com 409

Para descobrir produtos reais do ML automaticamente:

- `node scripts/fetch-ml.js "mouse gamer" 10` -> salva `ml-mouse-gamer.json`
- Revise o JSON gerado, copie os itens desejados para `produtos.reais.json`

Para limpar produtos demo antes de importar reais (opcional):

```bash
# no painel Turso ou via db.execute:
DELETE FROM produtos;
DELETE FROM cliques;
```

---

## FASE 5 — Documento de setup (guarde tudo)

### Contas criadas
- [x] Amazon Associates — tag: `titusindica-20` (login: ____ senha: ____)
- [ ] ML Parceiros — mf_id: _______ (login: ____ senha: ____)

### Hospedagem
- [ ] Render.com — login: ____
- [ ] GitHub — login: ____
- [ ] Turso — login: ____

### Canal
- [ ] Telegram: @ofertas_techgames
- [ ] Bio escrita com disclaimer

### Catalogo (10 produtos)
Preencher cada um com os 5 campos

### Variaveis do hub (.env — so depois)
```
TAG_AMAZON=titusindica-20
TAG_ML=____
ADMIN_TOKEN=____ (string longa tipo: "minha-senha-super-secreta-2026")
```

---

## FASE 6 — Disclaimer legal (obrigatorio)

Texto para bio/rodape:

> **Aviso:** Este canal participa de programas de afiliados da Amazon Associates e Mercado Livre Parceiros. Quando voce compra pelos links compartilhados, posso receber uma comissao — sem custo adicional pra voce.

Colocar em:
- [ ] Bio do Telegram/Instagram
- [ ] Rodape do site (quando existir)
- [ ] Posts longos (se viavel)

---

## CHECKLIST FINAL — antes de codar

```
CADASTROS:
  [x] Amazon Associates aprovado + tag anotada (titusindica-20)
  [ ] ML Parceiros aprovado + mf_id anotado

INFRA:
  [ ] Conta Turso + database criado
  [ ] Conta Render.com
  [ ] Conta GitHub + 2 repos
  [ ] (opcional) Dominio comprado

CANAL:
  [ ] Canal Telegram criado + bio com disclaimer
  [ ] (opcional) Instagram-nicho

CATALOGO:
  [ ] 10 produtos coletados (nome, slug, ASIN, ML_ID, loja, preco)
  [ ] Tabelas de comissao das 2 plataformas consultadas

DOCS:
  [ ] Tudo anotado num lugar (senhas, tags, IDs)
  [ ] String de ADMIN_TOKEN inventada
  [ ] Disclaimer criado
```

---

## Limitacoes conhecidas (aceitas)

1. Atualizacao de preco: manual no inicio, ML API automatiza depois
2. Relatorio de comissoes: vem de cada painel oficial separado
3. Render free tier hiberna apos 15min inativo (UptimeRobot gratis resolve)
4. Sem dominio proprio: link fica `seu-hub.onrender.com/go/slug`

## Evolucao futura (quando 3 vendas Amazon sairem)
- Solicitar Amazon PA-API -> automatizar catalogo
- Migrar para dominio proprio `.com.br` (R$40/ano)
- Possivel bifurcacao para loja propria (fora do escopo atual)

## O que É automatico
- Redirecionamento do clique
- Injecao da tag de afiliado na URL
- Registro de cliques

## O que NÃO é automatico
- Descobrir ofertas
- Cadastrar produtos no hub
- Postar links nos canais
- Saber comissoes (paineis separados)
- Postar dentro das lojas (impossivel)
