# Aurora Migration Instructions

Your sign-up is failing because the Aurora database schema hasn't been created yet. Better Auth needs the `user`, `session`, `account`, and `verification` tables, plus your app needs all the business tables.

## Why Sign-Up is Failing

When you try to sign up, Better Auth attempts to:
1. Create a user in the `"user"` table (doesn't exist)
2. Create a session in the `session` table (doesn't exist)
3. Call `handleFirstSignUp` to create an app user in the `users` table (doesn't exist)

All three fail because the tables weren't created.

## Fix: Run the Migration

**Step 1:** Get your `MIGRATION_SECRET`
- Go to Vercel → Project Settings → Environment Variables
- Look for `MIGRATION_SECRET` (you should have set this earlier)
- Copy the value

**Step 2:** Run the migration endpoint
Visit this URL in your browser (replace `YOUR_SECRET` with the actual secret):
```
https://design-system-foundation-xi.vercel.app/api/migrate?secret=YOUR_SECRET
```

You should get back:
```json
{
  "ok": true,
  "message": "Migration complete. 35/35 statements succeeded."
}
```

**Step 3:** Try signing up again
The sign-up should now work because all tables exist.

## What Gets Created

### App Tables
- `stores` — store master records
- `users` — app users linked to stores (now with `auth_id` for Better Auth)
- `categories`, `vendors`, `products` — inventory master data
- `batches` — stock intakes (FEFO tracking)
- `sales`, `sale_items` — transaction history

### Better Auth Tables
- `"user"` — authentication users (camelCase columns per Better Auth spec)
- `session` — active sessions
- `account` — external auth accounts (currently unused, reserved for future OAuth)
- `verification` — email verification tokens

### Enums
- `user_role` — owner, storekeeper, cashier
- `vendor_type` — direct, consignment
- `unit_type` — piece, pack, kg, litre, carton, dozen, bag

## Still Having Issues?

Check Vercel Function Logs:
1. Vercel Dashboard → Your Project → Deployments → Your Latest Deployment → Logs
2. Look for errors in `/api/migrate` or `/api/auth/sign-up/email`
3. Common issues:
   - AWS credentials not configured (can't connect to Aurora)
   - `MIGRATION_SECRET` is wrong
   - Database connection timeout
