# Troubleshooting: ngrok Endpoint Offline

## Error: ERR_NGROK_3200 - Endpoint is offline

This means ngrok can't reach your local server. Here's how to fix it:

## Quick Fix

### Step 1: Start Your App Server

Open a terminal and run:
```bash
cd /Users/daviderichsen/Apps/ShopInbtweenReports
npm run dev
```

Or start just the server:
```bash
npm run dev:server
```

You should see:
```
Server running on port 3000
```

### Step 2: Start ngrok (in a NEW terminal)

Open a **separate terminal** and run:
```bash
ngrok http 3000
```

You should see:
```
Forwarding  https://some-url.ngrok-free.app -> http://localhost:3000
```

### Step 3: Check if URL Changed

If ngrok shows a **different URL** than `76ed79fc75aa.ngrok-free.app`:
- Your ngrok URL changed (this happens when you restart ngrok)
- Update your `.env` file with the new URL
- Update Partner Dashboard with the new URL

## Common Causes

### 1. App Server Not Running
**Symptom:** ngrok is running but endpoint is offline
**Fix:** Start your app server (`npm run dev`)

### 2. ngrok Not Running
**Symptom:** Can't access the ngrok URL at all
**Fix:** Start ngrok (`ngrok http 3000`)

### 3. Port Mismatch
**Symptom:** Server running on different port
**Fix:** Make sure server is on port 3000, or update ngrok: `ngrok http YOUR_PORT`

### 4. ngrok URL Changed
**Symptom:** Old URL doesn't work, new ngrok session
**Fix:** Update `.env` and Partner Dashboard with new URL

## Verification Steps

1. **Check server is running:**
   ```bash
   curl http://localhost:3000
   ```
   Should return something (even if it's an error, that means server is up)

2. **Check ngrok is running:**
   - Look at ngrok terminal - should show "Session Status: online"
   - Or visit: `http://localhost:4040` (ngrok web interface)

3. **Check URL matches:**
   - ngrok terminal shows: `https://abc123.ngrok-free.app`
   - `.env` has: `SHOPIFY_APP_URL=https://abc123.ngrok-free.app`
   - Partner Dashboard has same URL

## Quick Start Checklist

- [ ] Terminal 1: `npm run dev` (or `npm run dev:server`)
- [ ] Terminal 2: `ngrok http 3000`
- [ ] Verify server shows: "Server running on port 3000"
- [ ] Verify ngrok shows: "Session Status: online"
- [ ] Copy ngrok URL from terminal
- [ ] Update `.env` if URL changed
- [ ] Update Partner Dashboard if URL changed

## Still Not Working?

1. **Kill existing processes:**
   ```bash
   # Kill anything on port 3000
   lsof -ti:3000 | xargs kill -9
   
   # Restart fresh
   npm run dev
   ```

2. **Check for errors:**
   - Look at server terminal for error messages
   - Look at ngrok terminal for connection issues

3. **Verify environment:**
   ```bash
   npm run check-setup
   ```




