# How to Update Redirect URL in Partner Dashboard

## Steps to Update Redirect URL

### Option 1: Update in Current Version (Recommended)

1. Go to https://partners.shopify.com/
2. Click on **"Apps"** in the left sidebar
3. Click on your app: **"ShopInbtweenReports"**
4. Go to **"Settings"** tab (or **"App setup"**)
5. Scroll down to **"Allowed redirection URL(s)"** section
6. Click **"Add URL"** or **"Edit"** (if URLs already exist)
7. Add or update to:
   ```
   https://33d84ea52e46.ngrok-free.app/auth/callback
   ```
8. Click **"Save"**

**Note:** Changes to redirect URLs take effect immediately - no need to create a new version.

### Option 2: Create a New Version (If Option 1 Doesn't Work)

If you can't edit in Settings:

1. Go to your app dashboard
2. Click **"Versions"** tab
3. Click **"New version"** or **"Create version"**
4. In the new version, update:
   - **App URL**: `https://33d84ea52e46.ngrok-free.app`
   - **Allowed redirection URL(s)**: `https://33d84ea52e46.ngrok-free.app/auth/callback`
5. Save the version
6. Make it **"Active"** if needed

## Important Notes

- **Redirect URLs can be updated** without affecting installed stores
- **No re-installation needed** - existing installs continue working
- **Changes are immediate** - no deployment required
- **You can have multiple redirect URLs** - just add the new one

## What to Update

1. **App URL**: `https://33d84ea52e46.ngrok-free.app`
2. **Redirect URL**: `https://33d84ea52e46.ngrok-free.app/auth/callback`

Both should match your current ngrok URL exactly.




