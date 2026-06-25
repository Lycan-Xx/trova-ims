# Clerk Webhook Setup Guide

## Status
✅ Webhook secret `CLERK_WEBHOOK_SECRET` is now configured in your Vercel environment.
✅ Webhook handler at `/api/webhooks/clerk` is ready to receive events.

## Next Steps: Configure in Clerk Dashboard

### 1. Go to Clerk Dashboard
- Visit: https://dashboard.clerk.com
- Select your application

### 2. Navigate to Webhooks
- Left sidebar → **Webhooks**
- Click **Create Endpoint** (or edit existing if you have one)

### 3. Set the Endpoint URL
The webhook URL depends on where your app is deployed:

**For local testing (v0 preview):**
- The v0 preview gives you a temporary URL like `https://v0-project-xxxxx.vercel.app`
- Use: `https://v0-project-xxxxx.vercel.app/api/webhooks/clerk`

**For production (after deployment to Vercel):**
- Use your production domain: `https://yourdomain.com/api/webhooks/clerk`

### 4. Select Events to Subscribe To
Check the box for:
- ✅ **user.created** (this is what the app needs to auto-create user records in Neon)

You can optionally add:
- `user.updated` (to sync profile changes)
- `user.deleted` (to soft-delete users)

### 5. Verify the Secret
- Clerk will show a signing secret (the one you created: `whsec_3ZxTZ7z5wZlsmxC0heJKVM3cofEtKJ9g`)
- This is already saved in your Vercel env as `CLERK_WEBHOOK_SECRET` ✓

### 6. Test the Webhook
After saving:
1. Sign out of your app
2. Create a new account by signing up
3. The webhook will fire → your app will create a `users` record in Neon
4. You'll automatically be logged in and redirected to `/dashboard`

## How It Works

```
User signs up via Clerk
         ↓
Clerk fires user.created event
         ↓
Webhook hits /api/webhooks/clerk
         ↓
App verifies signature with CLERK_WEBHOOK_SECRET
         ↓
App calls handleFirstSignUp()
         ↓
Neon: Create stores record (if first user)
Neon: Create users record with role='owner' (or 'cashier')
         ↓
User is now ready to use the app ✓
```

## Troubleshooting

**"Webhook signature verification failed"**
- Check that `CLERK_WEBHOOK_SECRET` matches the value in Clerk
- Verify the endpoint URL is exactly correct (including the `/api/webhooks/clerk` path)

**User still can't access sales/alerts/analytics**
- Sign out completely
- Sign up with a new email address
- The webhook will create your user record

**Webhook isn't firing**
- Go back to Clerk webhooks → click your endpoint → **Testing**
- Send a test `user.created` event
- Check app logs to see if it was received

## Files Involved
- `/app/api/webhooks/clerk/route.ts` — Webhook handler
- `/lib/auth/first-run.ts` — Creates user & store on first signup
- `CLERK_WEBHOOK_SECRET` env var — Signs the webhook
