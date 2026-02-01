# Quick Configuration Guide

## Your ngrok URL
```
https://76ed79fc75aa.ngrok-free.app
```

## What to Configure

### 1. Update .env File

Edit your `.env` file and set:
```env
SHOPIFY_APP_URL=https://76ed79fc75aa.ngrok-free.app
```

### 2. Shopify Partner Dashboard

#### App URL:
```
https://76ed79fc75aa.ngrok-free.app
```

#### Allowed Redirection URL(s):
Add this URL:
```
https://76ed79fc75aa.ngrok-free.app/auth/callback
```

### 3. Complete .env File

Your `.env` should have:
```env
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_APP_URL=https://76ed79fc75aa.ngrok-free.app
SCOPES=read_orders,read_products
DATABASE_URL=postgresql://your_user@localhost:5432/shopify_reports?schema=public
REDIS_URL=redis://localhost:6379
SESSION_SECRET=your_session_secret
NODE_ENV=development
PORT=3000
```

## Important Notes

⚠️ **ngrok-free.app URLs:**
- This is a free ngrok URL (notice the `ngrok-free.app` domain)
- It may show a warning page on first visit (this is normal)
- The URL will change if you restart ngrok
- Keep ngrok running while testing

## Next Steps

1. ✅ Update `.env` with your ngrok URL
2. ✅ Update Partner Dashboard with App URL and Redirect URL
3. ✅ Make sure ngrok is still running (`ngrok http 3000`)
4. ✅ Start your app: `npm run dev`
5. ✅ Install app: Visit `https://76ed79fc75aa.ngrok-free.app/auth?shop=your-store.myshopify.com`

## Testing

Once configured, test the installation:
```
https://76ed79fc75aa.ngrok-free.app/auth?shop=your-store-name.myshopify.com
```

Replace `your-store-name` with your actual Shopify store name.




