# How to Find Your Clerk User ID

Your Clerk ID is unique to your Clerk account. You need it to sync with the database so you can access all app pages.

## Quick Method (Browser Console)

1. **Open the app** in your browser (even though you get redirected, that's fine)
2. **Open DevTools:**
   - Windows/Linux: `F12` or `Ctrl+Shift+I`
   - Mac: `Cmd+Shift+I` or `Cmd+Option+I`
3. **Go to the "Console" tab**
4. **Paste this code** and press Enter:
   ```javascript
   fetch('/api/auth/session').then(r => r.json()).then(s => {
     if (s.user?.id) {
       console.log('✓ Your Clerk ID:', s.user.id);
       // Copy this ID and use it in: node scripts/sync-clerk-user.mjs <id>
     } else {
       console.log('Session data:', s);
     }
   })
   ```
5. **Copy the ID** that appears in the console
   - It looks like: `user_2kZZpKKL91N4Qjz7Mv7...`

## Using the Sync Script

Once you have your Clerk ID:

```bash
# Set your DATABASE_URL (from Neon)
export DATABASE_URL="postgresql://..."

# Run the sync script with your Clerk ID
node scripts/sync-clerk-user.mjs user_2kZZpKKL91N4Qjz7Mv7...

# You should see:
# ✓ Created new store and user
# ✓ You should now be able to access all pages!
```

## What the Script Does

- Creates a **Store** (if none exists)
- Creates a **User** record in the database
- Links the user to the store
- Sets role to **owner** (full access)

After running, **refresh the app** and you'll have access to:
- `/dashboard` ✓
- `/products` ✓
- `/vendors` ✓
- `/intake` ✓
- `/sales` ✓
- `/alerts` ✓
- `/analytics` ✓
- `/settings` ✓

## Still Not Working?

If you still get redirected after syncing:

1. **Hard refresh**: `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
2. **Clear cookies**: DevTools → Application → Cookies → Delete Clerk cookies
3. **Sign out and back in**: Avatar → Sign Out → Sign In
4. **Check the database manually**:
   ```bash
   node -e "
   const pg = require('pg');
   const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
   (async () => {
     const result = await pool.query('SELECT COUNT(*)::int as count FROM users');
     console.log('Users in DB:', result.rows[0].count);
     await pool.end();
   })();
   "
   ```
   Should show `Users in DB: 1` (or more)
