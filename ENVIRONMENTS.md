# Guia de Ambientes - Dev & Produção

## Desenvolvimento

### Iniciar o app local
```bash
shopify app dev --config=shopify.app.dev.toml
```

### Rodar migrations no banco de dev
```bash
npx dotenv -e .env.dev -- npx prisma migrate deploy
```

### Criar nova migration
```bash
# 1. Editar prisma/schema.prisma
# 2. Criar a pasta e o SQL manualmente em prisma/migrations/<timestamp>_<nome>/migration.sql
# 3. Aplicar no banco de dev:
npx dotenv -e .env.dev -- npx prisma migrate deploy
```

### Regenerar Prisma Client
```bash
npx prisma generate
```

### Acessar o banco de dev (Prisma Studio)
```bash
npx dotenv -e .env.dev -- npx prisma studio
```

### Deploy da extension (dev)
```bash
shopify app deploy --config=shopify.app.dev.toml
```

---

## Produção

### Rodar migrations no banco de produção
```bash
npx prisma migrate deploy
```
> O `.env` padrão contém o `DATABASE_URL` de produção. Em Docker, a variável vem do container.

### Build
```bash
npm run build
```

### Deploy do app para Shopify
```bash
shopify app deploy --config=shopify.app.toml
```

### Docker (produção)
```bash
# Build da imagem
docker build -t anbar .

# Rodar (DATABASE_URL deve ser passado como env var)
docker run -e DATABASE_URL="postgresql://..." -e SHOPIFY_API_KEY="..." -e SHOPIFY_API_SECRET="..." -p 3000:3000 anbar
```
> O container roda `prisma migrate deploy` automaticamente no startup via `npm run setup`.

---

## Referência rápida

| Ação | Dev | Produção |
|------|-----|----------|
| **Config** | `shopify.app.dev.toml` | `shopify.app.toml` |
| **Env file** | `.env.dev` (só DATABASE_URL) | `.env` ou env vars do container |
| **Database** | Neon us-east-1 | Neon us-east-2 |
| **Client ID** | `835f15...` | `4d36bf...` |
| **App handle** | `anbar-dev` | `anbar-1` |
| **NODE_ENV** | `development` (auto) | `production` |
| **Billing isTest** | `true` (auto) | `false` |

## Cuidados

- **Nunca** instale os dois apps (dev + prod) na mesma loja ao mesmo tempo — o app proxy `/apps/anbar` conflita.
- **Sempre** rode a migration no banco de produção **antes** de fazer deploy de código que usa campos novos.
- O `.env` e `.env.dev` estão no `.gitignore` — nunca serão commitados.
