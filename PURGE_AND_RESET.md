# Database Purge & Reset Guide

## ✅ What Has Been Purged

### Neon Database
- **Status**: ✅ Already purged locally
- All tables dropped: `sale_items`, `sales`, `batches`, `products`, `categories`, `vendors`, `users`, `stores`, `verification`, `account`, `session`, `user`
- All enums/types dropped: `user_role`, `vendor_type`, `unit_type`
- **To fully disconnect Neon**: Go to Vercel project Settings → Integrations and remove the Neon integration

### Aurora Database (AWS)
- **Status**: Ready to purge on production deployment
- All tables will be dropped via the `/api/purge` endpoint
- All enums/types will be dropped

---

## 🚀 Steps to Complete the Reset

### Step 1: Deploy to Vercel
Push the code to your GitHub branch and deploy to Vercel. This includes:
- `app/api/purge/route.ts` — the purge endpoint
- Updated `middleware.ts` with `/api/purge` public route
- Aurora IAM connection in `lib/db/index.ts` (already restored)

### Step 2: Purge Aurora (if using Aurora)
Once deployed, visit:
```
https://design-system-foundation-xi.vercel.app/api/purge?secret=YOUR_MIGRATION_SECRET
```

Expected response:
```json
{
  "ok": true,
  "message": "Aurora purged: 15 statements executed. All tables, enums, and data deleted."
}
```

### Step 3: Run Fresh Migration
After purge completes, run the full schema setup:
```
https://design-system-foundation-xi.vercel.app/api/migrate?secret=YOUR_MIGRATION_SECRET
```

Expected response:
```json
{
  "ok": true,
  "message": "Migration complete. 35/35 statements succeeded."
}
```

### Step 4: Start Fresh
- Sign up with a new account
- You'll be the first user → automatically created as `owner` with a new `My Store`
- All features ready to test with clean data

---

## 📋 Cleanup Checklist

- [ ] Code deployed to Vercel with new purge & migrate endpoints
- [ ] Called `/api/purge?secret=...` on production
- [ ] Called `/api/migrate?secret=...` on production  
- [ ] Verified both returned success
- [ ] Signed up with test account
- [ ] Dashboard loads correctly
- [ ] Can create products, batches, vendors, sales
- [ ] Settings shows only your store's users (if multiple stores set up)

---

## ⚠️ Neon Integration Removal

If you want to completely remove Neon from the project:

1. **Vercel Dashboard** → Your Project → Settings → Integrations → Neon → Disconnect
2. **Environment Variables** → Remove `NEON_DATABASE_URL` or `DATABASE_URL` if it points to Neon
3. This won't affect Aurora, which is now the active database

---

## 🔄 If You Need to Switch Back to Neon

If you ever want to use Neon again instead of Aurora:

1. Reconnect Neon integration
2. Get the new `DATABASE_URL`
3. Update `lib/db/index.ts` to use simple `new Pool({ connectionString: process.env.DATABASE_URL })`
4. Run migrations against Neon

But with Aurora fully configured, you don't need Neon anymore.

---

## 📞 Troubleshooting

**"Unauthorized" error when calling `/api/purge` or `/api/migrate`**
- Check that `MIGRATION_SECRET` env var is set in Vercel project
- Check that the `secret` query parameter matches exactly

**"relation does not exist" errors after purge**
- This is expected the first time — purge + migrate in sequence
- Purge removes everything, migrate recreates from scratch

**Tests failing after purge**
- The test suite creates isolated test data with a unique `store_uuid`
- After purge, tests will work fine on fresh run: `pnpm test`
