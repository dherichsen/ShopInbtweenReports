# How to Find Your Shopify API Keys

## Step-by-Step Guide

### Option 1: Client Credentials (Most Common)

1. In your app dashboard, look for **"Client credentials"** section
2. You should see:
   - **API key** (also called "Client ID")
   - **API secret key** (also called "Client secret")
3. Click **"Reveal"** or **"Show"** next to the API secret to see it
4. Copy both values

### Option 2: Settings Tab

1. Click on **"Settings"** in the left sidebar
2. Look for **"App credentials"** or **"API credentials"** section
3. You'll see:
   - **API key**
   - **API secret key**

### Option 3: App Setup

1. Click on **"Settings"** → **"App setup"**
2. Scroll down to find **"Client credentials"**
3. Your API key and secret will be displayed there

## What You're Looking For

You need two values:

1. **API key** (or Client ID)
   - Example: `abc123def456ghi789`
   - Usually visible immediately

2. **API secret key** (or Client secret)
   - Example: `shpss_abc123def456ghi789`
   - May be hidden - click "Reveal" or "Show" to see it

## Visual Guide

```
Partner Dashboard → Your App → Settings → Client credentials

┌─────────────────────────────────────────┐
│ Client credentials                      │
├─────────────────────────────────────────┤
│ API key                                 │
│ abc123def456ghi789                      │ ← Copy this
│                                         │
│ API secret key                          │
│ [Reveal]  shpss_abc123def456ghi789      │ ← Click Reveal, then copy
└─────────────────────────────────────────┘
```

## After You Find Them

Add to your `.env` file:

```env
SHOPIFY_API_KEY=abc123def456ghi789
SHOPIFY_API_SECRET=shpss_abc123def456ghi789
```

## Can't Find Them?

If you don't see the credentials:
1. Make sure you're looking at the correct app
2. Check if you need to create a new version first
3. Try refreshing the page
4. Look in different sections: Settings, App setup, or Overview

## Security Note

⚠️ **Never share your API secret key publicly!**
- Keep it in `.env` file (which is gitignored)
- Don't commit it to version control
- Don't share it in screenshots or messages




