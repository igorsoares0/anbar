# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start development server
npm run dev

# Build the application
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Database setup (run after fresh clone or schema changes)
npm run setup

# Deploy to Shopify
npm run deploy

# GraphQL code generation
npm run graphql-codegen
```

## Architecture Overview

This is a Shopify app built with Remix framework that includes:

- **Main App**: Remix-based web application in `/app` directory
- **Theme Extension**: Shopify theme extension in `/extensions/anbar` with Liquid templates
- **Database**: Prisma ORM with SQLite for session storage
- **Authentication**: Shopify App Bridge with OAuth flow

### Key Files

- `app/shopify.server.ts` - Main Shopify app configuration and authentication setup
- `app/db.server.ts` - Prisma database client
- `prisma/schema.prisma` - Database schema (Session model for Shopify auth)
- `shopify.app.toml` - App configuration with scopes (`write_products`) and webhooks
- `shopify.extension.toml` - Theme extension configuration

### Directory Structure

```
app/
├── routes/          # Remix routes
│   ├── app._index.tsx    # Main app page with product creation demo
│   ├── app.additional.tsx # Additional app page
│   ├── webhooks/         # Webhook handlers
│   └── auth/            # Authentication routes
├── shopify.server.ts    # Shopify configuration
└── db.server.ts        # Database client

extensions/anbar/        # Theme extension
├── blocks/             # Liquid blocks (star_rating.liquid)
├── snippets/           # Liquid snippets (stars.liquid)
└── locales/            # Translation files
```

### GraphQL Configuration

Uses `@shopify/api-codegen-preset` for Admin API type generation. Configuration in `.graphqlrc.ts` automatically detects extensions with GraphQL schemas.

### Environment Requirements

- Node.js 18.20+ or 20.10+
- Shopify Partner account and development store
- Required environment variables: `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`

### Development Notes

- Uses embedded app pattern with App Bridge React
- Session storage handled by Prisma with SQLite
- Webhooks configured for app uninstall and scope updates
- Theme extension provides star rating functionality for Shopify themes