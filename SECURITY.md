# Security Guidelines

## Environment Variables Management

### Development Setup

1. **Copy the local environment template:**
   ```bash
   cp .env.local.example .env.local
   ```

2. **Fill in your development values:**
   - `SHOPIFY_API_SECRET` - Your app's API secret from Partner Dashboard
   - `SHOPIFY_APP_URL` - Your tunnel URL (CloudFlare, ngrok, etc.)
   - `DATABASE_URL` - Your local database connection

3. **Client ID is automatically read from `shopify.app.toml`** during development

### Production Deployment

1. **Use environment variables for ALL sensitive data:**
   ```bash
   SHOPIFY_API_KEY=your_production_api_key
   SHOPIFY_API_SECRET=your_production_api_secret
   SHOPIFY_APP_URL=https://your-production-domain.com
   DATABASE_URL=your_production_database_url
   NODE_ENV=production
   ```

2. **NEVER commit sensitive data to version control**

### Security Best Practices

#### ✅ Safe to Commit:
- `client_id` in `shopify.app.toml` (public identifier)
- App configuration (scopes, webhooks)
- Public URLs in development

#### ❌ NEVER Commit:
- `SHOPIFY_API_SECRET` 
- Database passwords
- Access tokens
- Production URLs with sensitive info

### File Security

- `.env*` files are in `.gitignore` ✅
- Use `.env.example` for documentation
- Use `.env.local` for local development (ignored by git)

### Logging Security

- Production logs are minimized ✅
- Debug logs only appear with `?anbar_debug=1` parameter ✅
- No sensitive data in logs ✅

### App Store Readiness

This app follows Shopify's security requirements:
- ✅ OAuth flow implemented correctly
- ✅ Session storage via Prisma (secure)
- ✅ Webhook verification
- ✅ No hardcoded secrets in production
- ✅ Minimal logging in production