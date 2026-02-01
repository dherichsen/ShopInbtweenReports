# How to Get Your ngrok URL

## Step-by-Step Guide

### 1. Start ngrok

Open a terminal and run:
```bash
ngrok http 3000
```

This starts ngrok and creates a tunnel to your local port 3000 (where your app runs).

### 2. Look at the Terminal Output

After starting ngrok, you'll see output like this:

```
ngrok

Session Status                online
Account                       Your Name (Plan: Free)
Version                       3.19.0
Region                        United States (us)
Latency                       45ms
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123xyz.ngrok.io -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

### 3. Find Your URL

Look for the line that says **"Forwarding"**:

```
Forwarding    https://abc123xyz.ngrok.io -> http://localhost:3000
```

The part **before** the arrow (`->`) is your ngrok URL:
```
https://abc123xyz.ngrok.io
```

**Copy this URL** - this is what you'll use!

### 4. Alternative: Use the Web Interface

ngrok also provides a web interface at `http://127.0.0.1:4040`

1. Open your browser
2. Go to: `http://localhost:4040`
3. You'll see a dashboard showing:
   - Your public URL (the ngrok URL)
   - Request/response details
   - Traffic inspection

## Visual Guide

```
Terminal Output:
┌─────────────────────────────────────────────────┐
│ Forwarding  https://abc123.ngrok.io             │ ← THIS IS YOUR URL
│              -> http://localhost:3000           │
└─────────────────────────────────────────────────┘
```

## Important Notes

### ⚠️ Free ngrok URLs Change

If you're using **free ngrok**:
- The URL changes **every time you restart ngrok**
- Keep ngrok running while testing
- Update your `.env` and Partner Dashboard if you restart ngrok

### ✅ Paid ngrok (Optional)

If you upgrade to a paid ngrok plan:
- You can get a **fixed domain** that doesn't change
- Useful for development over multiple days
- Not required for testing

## Quick Checklist

1. ✅ Start ngrok: `ngrok http 3000`
2. ✅ Look for "Forwarding" line in terminal
3. ✅ Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. ✅ Use this URL in:
   - `.env` file → `SHOPIFY_APP_URL`
   - Partner Dashboard → App URL
   - Partner Dashboard → Redirect URL

## Example Workflow

```bash
# Terminal 1: Start ngrok
$ ngrok http 3000

# Output shows:
Forwarding  https://abc123xyz.ngrok.io -> http://localhost:3000

# Copy: https://abc123xyz.ngrok.io

# Now use this URL in:
# 1. .env file
SHOPIFY_APP_URL=https://abc123xyz.ngrok.io

# 2. Partner Dashboard
App URL: https://abc123xyz.ngrok.io
Redirect URL: https://abc123xyz.ngrok.io/auth/callback
```

## Troubleshooting

### ngrok not installed?
```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### Port 3000 already in use?
```bash
# Use a different port
ngrok http 3001

# Then update your app's PORT in .env
```

### Can't see the URL?
- Make sure ngrok is running (check the terminal)
- Look for the "Forwarding" line
- Or open `http://localhost:4040` in your browser

## Next Steps

Once you have your ngrok URL:
1. Copy it
2. Update `.env` file: `SHOPIFY_APP_URL=https://your-url.ngrok.io`
3. Update Partner Dashboard with this URL
4. Keep ngrok running while testing!




