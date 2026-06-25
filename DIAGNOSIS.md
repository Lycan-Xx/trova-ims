# Why Sales, Alerts, Analytics, and Settings Redirect to Sign-In

## Root Cause

You are **authenticated in Clerk** (you can see your avatar in the topbar), but you **do not have a user record in the Neon database**. When you try to access these pages:

1. **Sales** (`/sales`) → calls `getCurrentUser()` → queries `users` table → finds no record → returns `null` → page redirects to `/sign-in`
2. **Alerts** (`/alerts`) → calls `requireStoreAccess()` → no user found → throws redirect
3. **Analytics** (`/analytics`) → calls `requireOwner()` → no user found → throws redirect
4. **Settings** (`/settings`) → calls `getCurrentUser()` → returns `null` → redirects

## Why This Happened

When you signed up, the Clerk webhook should have automatically created a `users` record in the database. But the webhook **never ran** or **failed silently**, leaving your Clerk account without a corresponding database record.

Check your Neon database:
```sql
SELECT COUNT(*) FROM users;   -- Should show 1+, but shows 0
SELECT COUNT(*) FROM stores;  -- Should show 1+, but shows 0
```

## Fix: Sync Your Clerk ID

### Option 1: Auto-Sync (Recommended)

1. **Get your Clerk user ID** from the app's browser console:
   ```javascript
   // Open DevTools → Console in your browser
   // Paste this and press Enter:
   fetch('/api/auth/session').then(r => r.json()).then(s => console.log(s.user?.id))
   ```
   Copy the ID that gets logged (looks like `user_xxx123...`)

2. **Run the sync script**:
   ```bash
   DATABASE_URL="your-neon-connection-string" node scripts/sync-clerk-user.mjs user_xxx123...
   ```

3. **Refresh the app** — you should now see all pages working

### Option 2: Manual Entry

Create a user record directly in Neon using the Neon console or `psql`:

```sql
-- Create store (if not exists)
INSERT INTO stores (id, name, address, phone, created_at)
VALUES (gen_random_uuid(), 'My Store', NULL, NULL, NOW())
RETURNING id;

-- Copy the returned UUID and use it below
INSERT INTO users (id, clerk_id, store_id, name, email, role, is_active, created_at)
VALUES (
  gen_random_uuid(),
  'user_YOUR_CLERK_ID_HERE',  -- Replace with your actual Clerk ID
  'STORE_UUID_HERE',          -- From the INSERT above
  'Your Name',
  'your-email@example.com',
  'owner',
  true,
  NOW()
);
```

### Option 3: Sign Out and Re-Sign-Up

If the webhook is now working correctly:
1. Sign out (click user avatar → Sign Out)
2. Sign in again with Clerk
3. The webhook should create your user record automatically

## Why the Webhook Didn't Run

Common reasons:
- **Webhook URL not configured** in Clerk dashboard — check Settings → Webhooks
- **Webhook URL pointing to wrong domain** — should be `https://your-app-domain/api/webhooks/clerk`
- **Webhook secret (`CLERK_WEBHOOK_SECRET`) not set** in Vercel environment
- **Endpoint path mismatch** — Clerk sends to `/api/webhooks/clerk`, app listens there ✓

## Verify the Fix

After syncing, you should be able to:
- ✅ Access `/sales`
- ✅ Access `/alerts`  
- ✅ Access `/analytics`
- ✅ Access `/settings`

All pages will now load because `getCurrentUser()` will find your record and return a user object instead of `null`.
