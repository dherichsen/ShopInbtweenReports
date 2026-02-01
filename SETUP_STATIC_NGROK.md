# Setting Up Static ngrok Domain

## Step 1: Find Your Static Domain

You have 3 static domains available. To see them:

**Option A: ngrok Dashboard**
1. Go to https://dashboard.ngrok.com/domains
2. You'll see your available static domains listed

**Option B: ngrok CLI**
```bash
ngrok api domains list
```

## Step 2: Choose a Domain

Pick one of your static domains (e.g., `myapp.ngrok-free.app`)

## Step 3: Start ngrok with Static Domain

Stop your current ngrok (Ctrl+C), then run:

```bash
ngrok http 3000 --domain=your-chosen-domain.ngrok-free.app
```

Replace `your-chosen-domain.ngrok-free.app` with your actual static domain.

## Step 4: Update .env File

Once ngrok is running with the static domain, I'll update your `.env`:

```env
SHOPIFY_APP_URL=https://your-static-domain.ngrok-free.app
```

## Step 5: Update Partner Dashboard (One Time!)

Since it's static, you only need to do this ONCE:

1. **App URL**: `https://your-static-domain.ngrok-free.app`
2. **Redirect URL**: `https://your-static-domain.ngrok-free.app/auth/callback`

## Benefits

✅ URL never changes  
✅ Update Partner Dashboard once  
✅ No more URL mismatches  
✅ Works every time you restart ngrok  

## After Setup

1. Keep ngrok running with the static domain
2. Keep server running
3. The app will always use the same URL




