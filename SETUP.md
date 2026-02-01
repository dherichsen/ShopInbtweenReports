# Quick Setup Guide

## Step-by-Step Setup

### 1. Prerequisites Check
```bash
node --version  # Should be 20+
psql --version   # PostgreSQL should be installed
redis-cli ping   # Should return PONG
```

### 2. Environment Setup
```bash
# Copy and edit .env file
cp .env.example .env

# Required variables to set:
# - SHOPIFY_API_KEY
# - SHOPIFY_API_SECRET  
# - SHOPIFY_APP_URL (your ngrok URL)
# - DATABASE_URL
# - REDIS_URL
```

### 3. Database Setup
```bash
# Generate Prisma client
npm run prisma:generate

# Create database (if not exists)
createdb shopify_reports  # or use your preferred method

# Run migrations
npm run prisma:migrate
```

### 4. Install Dependencies
```bash
# Root dependencies
npm install

# Client dependencies
cd client && npm install && cd ..
```

### 5. Start ngrok (in separate terminal)
```bash
ngrok http 3000
# Copy the https URL (e.g., https://abc123.ngrok.io)
# Update SHOPIFY_APP_URL in .env
```

### 6. Configure Shopify App
1. Go to https://partners.shopify.com/
2. Create/select app
3. Set App URL: `https://your-ngrok-url.ngrok.io`
4. Set Allowed redirection URL: `https://your-ngrok-url.ngrok.io/auth/callback`
5. Set scopes: `read_orders`, `read_products`
6. Copy API Key and Secret to `.env`

### 7. Start Application
```bash
# Option 1: Run all processes
npm run dev

# Option 2: Run separately (3 terminals)
# Terminal 1:
npm run dev:server

# Terminal 2:
npm run dev:client

# Terminal 3:
npm run dev:worker
```

### 8. Install App on Store
Visit: `https://your-ngrok-url.ngrok.io/auth?shop=your-store.myshopify.com`

## Troubleshooting

**Port already in use:**
- Change PORT in .env or kill process on port 3000

**Prisma errors:**
- Ensure DATABASE_URL is correct
- Run `npm run prisma:generate` again

**Redis connection errors:**
- Ensure Redis is running: `redis-cli ping`
- Check REDIS_URL in .env

**Shopify OAuth errors:**
- Verify SHOPIFY_APP_URL matches ngrok URL exactly
- Check API Key and Secret are correct
- Ensure redirect URL is configured in Partner Dashboard

**Worker not processing:**
- Check Redis is running
- Verify REDIS_URL is correct
- Check worker terminal for errors

