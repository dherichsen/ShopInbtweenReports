# Railway Deployment Guide

## Quick Deploy to Railway

Railway makes deployment super easy! Here's how to deploy your Shopify app:

**Important:** Once deployed to Railway, you **don't need ngrok anymore** for production. Railway provides a permanent public URL. You can still use ngrok for local development if needed, but your production app will use Railway's URL.

### Step 1: Create Railway Account
1. Go to https://railway.app/
2. Sign up with GitHub (recommended)

### Step 2: Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Connect your GitHub account and select the `ShopInbtweenReports` repository

### Step 3: Add Services

You need **3 services**:

#### Service 1: Web Server (Main App)
1. Railway will auto-detect your repo
2. Click "Add Service" → "GitHub Repo" → Select your repo
3. Railway will auto-detect it's a Node.js app
4. **Set the start command**: `npm start`
5. **Add environment variables** (see below)

#### Service 2: Worker (Background Jobs)
1. Click "Add Service" → "GitHub Repo" → Select the same repo
2. **Set the start command**: `npm run worker`
3. **Add the same environment variables** as the web service

#### Service 3: PostgreSQL Database
1. Click "Add Service" → "Database" → "Add PostgreSQL"
2. Railway will create a PostgreSQL database automatically
3. Copy the `DATABASE_URL` from the database service's "Variables" tab

#### Service 4: Redis
1. Click "Add Service" → "Database" → "Add Redis"
2. Railway will create a Redis instance automatically
3. Copy the `REDIS_URL` from the Redis service's "Variables" tab

### Step 4: Configure Environment Variables

For **both** the Web Server and Worker services, add these environment variables:

**Required Variables:**
```
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_APP_URL=https://your-app-name.up.railway.app
SCOPES=read_orders,read_products,read_customers
DATABASE_URL=<from PostgreSQL service>
REDIS_URL=<from Redis service>
SESSION_SECRET=<generate a random string>
NODE_ENV=production
```

**Note:** Railway automatically sets `PORT` - you don't need to set it manually.

**To get your Railway URL:**
1. Go to your Web Server service
2. Click "Settings" → "Generate Domain"
3. Copy the URL (e.g., `https://your-app-name.up.railway.app`)
4. Use this as your `SHOPIFY_APP_URL`

**To generate SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Update Shopify Partner Dashboard

1. Go to https://partners.shopify.com/
2. Select your app
3. Update **App URL**: `https://your-app-name.up.railway.app`
4. Update **Allowed redirection URL(s)**: `https://your-app-name.up.railway.app/auth/callback`
5. Make sure scopes are set: `read_orders`, `read_products`, `read_customers`

### Step 6: Deploy

1. Railway will automatically deploy when you push to your GitHub repo
2. Or click "Deploy" in the Railway dashboard
3. Check the logs to ensure both services start correctly

### Step 7: Verify Deployment

1. Visit your Railway URL: `https://your-app-name.up.railway.app`
2. You should see your app (or a redirect to Shopify auth)
3. Test by installing the app on a Shopify store

## Railway Pricing

- **Free Trial**: $5 credit to start
- **Hobby Plan**: $5/month (includes PostgreSQL + Redis)
- **Pro Plan**: $20/month (more resources)

For this app, the **Hobby Plan ($5/month)** should be sufficient!

## Build Time

Railway builds typically take **2-5 minutes**:
- Installing dependencies: ~30-60 seconds
- Building client (Vite): ~30-60 seconds  
- Prisma generate: ~10-20 seconds
- Starting app: ~10-20 seconds

If it takes longer, check the build logs for errors.

## ngrok vs Railway

**Local Development (ngrok):**
- Use ngrok when developing locally
- ngrok URL: `https://your-tunnel.ngrok-free.app`
- Set `SHOPIFY_APP_URL` to ngrok URL in `.env`

**Production (Railway):**
- Railway provides a permanent public URL
- Railway URL: `https://your-app.up.railway.app`
- Set `SHOPIFY_APP_URL` to Railway URL in Railway environment variables
- **No ngrok needed** - Railway handles the public URL

**Important:** Update your Shopify Partner Dashboard to use the Railway URL (not ngrok) for production!

## Troubleshooting

**Database migrations not running:**
- Check that `DATABASE_URL` is set correctly
- Check logs for Prisma errors
- You can manually run migrations: `railway run npm run prisma:migrate`

**Worker not processing jobs:**
- Ensure the Worker service is running
- Check that `REDIS_URL` is set correctly in both services
- Check worker service logs

**App not accessible:**
- Ensure `SHOPIFY_APP_URL` matches your Railway domain exactly
- Check that the web service is running (check logs)
- Verify environment variables are set

**Reports not generating:**
- Check that both Web and Worker services are running
- Verify Redis connection (check logs)
- Check database connection (check logs)

## File Storage

Railway provides ephemeral storage. Report files are stored in the `reports/` directory, but they will be lost when the service restarts. For production, consider:
- Using Railway's volume storage (paid feature)
- Or storing reports in a cloud storage service (S3, etc.)

For now, reports are generated on-demand and downloaded immediately, so this should be fine.

