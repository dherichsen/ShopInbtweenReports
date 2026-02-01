# Redirect URLs Explained

## What Are Redirect URLs?

Redirect URLs are the endpoints where Shopify sends users **after they authorize your app** during the OAuth installation process.

## How OAuth Flow Works

1. **User visits:** `https://your-app-url.ngrok.io/auth?shop=store.myshopify.com`
2. **Shopify redirects to:** Shopify's authorization page
3. **User clicks "Install"** → Grants permissions
4. **Shopify redirects back to:** Your redirect URL (this is what you configure)
5. **Your app receives:** Authorization code and creates a session

## What Redirect URLs to Configure

In your Shopify Partner Dashboard, you need to add these **Allowed redirection URL(s)**:

### Required Redirect URL
```
https://your-ngrok-url.ngrok.io/auth/callback
```

This is the standard callback endpoint that `@shopify/shopify-app-express` uses.

### Alternative Redirect URL (if needed)
```
https://your-ngrok-url.ngrok.io/auth/shopify/callback
```

Some Shopify app setups use this alternative path. It's safe to add both.

## Where to Configure

### In Shopify Partner Dashboard:

1. Go to https://partners.shopify.com/
2. Select your app
3. Go to **"App setup"** section
4. Scroll to **"Allowed redirection URL(s)"**
5. Click **"Add URL"** and enter:
   - `https://your-ngrok-url.ngrok.io/auth/callback`
6. (Optional) Add second URL:
   - `https://your-ngrok-url.ngrok.io/auth/shopify/callback`

## Example Configuration

If your ngrok URL is `https://abc123.ngrok.io`, you would add:

```
https://abc123.ngrok.io/auth/callback
```

## Why This Matters

- **Security:** Shopify only redirects to URLs you've explicitly allowed
- **OAuth Flow:** Without the correct redirect URL, the installation will fail
- **Error Prevention:** Prevents "redirect_uri_mismatch" errors

## Common Issues

### Error: "redirect_uri_mismatch"
**Cause:** Redirect URL in Partner Dashboard doesn't match what your app expects

**Fix:** 
- Check your `SHOPIFY_APP_URL` in `.env` matches your ngrok URL exactly
- Ensure redirect URL in Partner Dashboard matches: `https://your-url/auth/callback`
- No trailing slashes!

### Error: "Invalid redirect_uri"
**Cause:** URL format is incorrect or missing protocol

**Fix:**
- Must start with `https://` (not `http://`)
- Must match your ngrok URL exactly
- Include the full path: `/auth/callback`

## How Your App Handles It

The `@shopify/shopify-app-express` middleware automatically handles the OAuth callback at `/auth/callback`. You don't need to write any code for this - it's handled by the library.

When Shopify redirects to your callback URL:
1. The middleware receives the authorization code
2. Exchanges it for an access token
3. Stores the session in your database (via Prisma)
4. Redirects the user to your app

## Quick Checklist

- [ ] Get your ngrok URL (e.g., `https://abc123.ngrok.io`)
- [ ] Add redirect URL in Partner Dashboard: `https://your-url/auth/callback`
- [ ] Ensure `SHOPIFY_APP_URL` in `.env` matches your ngrok URL
- [ ] No trailing slashes in URLs
- [ ] Use `https://` not `http://`

## Visual Flow

```
User → https://your-app/auth?shop=store.myshopify.com
  ↓
Shopify Authorization Page
  ↓
User clicks "Install"
  ↓
Shopify → https://your-app/auth/callback?code=xxx&shop=store
  ↓
Your App (middleware handles it)
  ↓
Session created → User sees your app!
```

## Notes

- **Development:** Use your ngrok URL
- **Production:** Use your production domain
- **Multiple URLs:** You can add multiple redirect URLs if needed
- **Testing:** Each time you restart ngrok, update the redirect URL if it changes




