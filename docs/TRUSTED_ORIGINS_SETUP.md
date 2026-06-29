# Trusted Origins Configuration

## What is a Trusted Origin?

A **trusted origin** is a domain from which your Trova app accepts authentication requests. Better Auth uses this to prevent Cross-Site Request Forgery (CSRF) attacks by rejecting requests from untrusted domains.

## Common Error: "Invalid origin"

If you see this error:
```
ERROR [Better Auth]: Invalid origin: https://your-domain.vercel.app
POST /api/auth/sign-in/email 403
```

It means the domain making the request is not in your trusted origins list.

## How to Add Trusted Origins

### Option 1: Via Environment Variable (Recommended)

1. Go to **Vercel Project Settings** → **Environment Variables**
2. Add or edit the `TRUSTED_ORIGINS` variable
3. Enter your domains as a comma-separated list:

```
https://trova-ims.vercel.app,https://your-custom-domain.com,https://staging.vercel.app
```

4. Redeploy your app
5. Test the domain by signing in

### Option 2: Permanently in Code

Edit `lib/auth.ts` and add your domain to `TRUSTED_ORIGINS_CONFIG`:

```typescript
const TRUSTED_ORIGINS_CONFIG = [
  // Your custom domain here
  'https://your-custom-domain.com',
  // ... rest of origins
]
```

Then commit and push.

## Domains That Are Automatically Included

These are always trusted by default:

- **Production URL** (from `VERCEL_PROJECT_PRODUCTION_URL`)
- **Preview URLs** (from `VERCEL_URL`)
- **Local development** (http://localhost:3000, http://localhost:3001)
- **Custom domains** (from `TRUSTED_ORIGINS` env var)

## Common Domains to Add

### Vercel Deployments
- **Production**: `https://trova-ims.vercel.app`
- **Preview**: `https://trovà-{branch}.vercel.app` (auto-added if using `VERCEL_URL`)

### Custom Domains
- Your own domain: `https://inventory.mycompany.com`
- Staging domain: `https://staging.mycompany.com`
- Subdomains: `https://app.mycompany.com`

### Development/Testing
- Local: `http://localhost:3000`
- Mobile testing: `http://192.168.x.x:3000`

## Debugging

### Check Current Trusted Origins

When the app starts, it logs the configured origins to the console:

```
[auth] Trusted origins configured:
  - https://trova-ims.vercel.app
  - https://custom.com
  - http://localhost:3000
```

### Get the Origin Being Rejected

Check the server logs for the specific origin:

```
[auth-api-post] Invalid origin: https://my-new-domain.vercel.app
```

Then add that exact URL to `TRUSTED_ORIGINS`.

## Testing After Adding a Domain

1. **Redeploy** your app (if you edited `.env` or code)
2. **Open the new domain** in your browser
3. **Try signing in** to verify it works
4. **Check server logs** for any "Invalid origin" errors

## Multiple Environments

For a typical setup with multiple environments:

```
TRUSTED_ORIGINS=https://app.mycompany.com,https://staging.mycompany.com,https://app-staging-123.vercel.app
```

## Wildcard Domains

Better Auth does **not** support wildcard domains like `https://*.mycompany.com`. You must list each subdomain explicitly:

```
TRUSTED_ORIGINS=https://app.mycompany.com,https://api.mycompany.com,https://admin.mycompany.com
```

## Security Notes

- **Never** add `http://*` or `https://*` (too permissive)
- **Always** include the protocol (`https://` or `http://`)
- **Always** use `https://` in production
- **Never** commit secrets or production domains to git if they differ across environments — use env vars instead

## For Production Deployment

Before deploying to production:

1. Set `TRUSTED_ORIGINS` to your production domain
2. Set `BETTER_AUTH_URL` to your production domain
3. Test sign-in and sign-up
4. Check server logs for any auth errors

Example:
```
BETTER_AUTH_URL=https://trova-ims.vercel.app
TRUSTED_ORIGINS=https://trova-ims.vercel.app
```
