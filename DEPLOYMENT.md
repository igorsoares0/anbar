# 🚀 Production Deployment Guide

## Prerequisites

### Environment Variables
```bash
# Required for production
NODE_ENV=production
SHOPIFY_APP_URL=https://your-production-domain.com
DATABASE_URL=postgresql://user:pass@host:port/dbname
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret

# Optional
SHOPIFY_SCOPES=write_products
```

### Database Setup
```bash
# Run database migrations
npm run setup
```

## Pre-deployment Checklist

### 1. Database
- [ ] PostgreSQL database created
- [ ] DATABASE_URL environment variable set
- [ ] Run `npm run setup` to create tables

### 2. Shopify App Configuration
- [ ] App created in Shopify Partners
- [ ] App URL updated to production domain
- [ ] Webhook URLs updated to production:
  - `https://your-domain.com/webhooks/app/uninstalled`
  - `https://your-domain.com/webhooks/app/scopes_update`
  - `https://your-domain.com/webhooks/app/charges_update`
- [ ] Billing enabled in app settings

### 3. Environment
- [ ] NODE_ENV=production (enables real charges)
- [ ] SHOPIFY_APP_URL points to production domain
- [ ] SSL/HTTPS configured

## Billing Configuration

### Subscription Plans
- **Free Plan**: 1 announcement bar, $0
- **Pro Monthly**: Unlimited bars, $9.99/month
- **Pro Annual**: Unlimited bars, $99/year

### Webhooks
The app listens for:
- `app/uninstalled` - Cleans up data when app is removed
- `app_subscriptions/update` - Updates subscription status
- `app/scopes_update` - Handles scope changes

## Testing in Production

### 1. Billing Flow
1. Install app on test store
2. Try to create 2+ announcement bars (should hit limit)
3. Click "Upgrade" button
4. Complete payment in Shopify
5. Verify subscription is active
6. Verify unlimited announcement bars

### 2. Webhook Testing
- Uninstall/reinstall app to test cleanup
- Change subscription to test status updates

## Monitoring

### Error Logs
Monitor console logs for:
- `Billing Error - Create Charge Failed`
- `Billing Error - Activate Charge Failed`
- `Subscription sync failed`

### Database Monitoring
Watch for:
- Failed subscription creations
- Orphaned charges
- Inconsistent subscription states

## Troubleshooting

### Common Issues

**Charges fail to create:**
- Check SHOPIFY_APP_URL is correct
- Verify app has billing permissions
- Check shop is eligible for charges

**Subscriptions not syncing:**
- Check webhook URLs are accessible
- Verify database connection
- Check charge status in Shopify admin

**Limits not enforced:**
- Verify subscription table exists
- Check subscription status in database
- Ensure limit checks are working

### Recovery Commands

```bash
# Sync subscription manually
curl https://your-domain.com/app/billing/sync

# Check subscription status
# Access: /app/billing in browser
```

## Performance Notes

- Billing checks are cached per session
- Webhook processing is async
- Database queries are indexed for performance

## Security

- All API calls use authenticated sessions
- Charge creation includes CSRF protection
- Webhook signatures should be verified (recommended)
- No sensitive data in client-side logs