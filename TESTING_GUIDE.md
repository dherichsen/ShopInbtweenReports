# Testing Guide - Shopify Sales Report App

## Prerequisites Checklist

Before testing, ensure you have:
- [ ] Node.js 20+ installed
- [ ] PostgreSQL running and accessible
- [ ] Redis running and accessible
- [ ] Shopify Partner account (free at partners.shopify.com)
- [ ] Development store (create one in Partner Dashboard)
- [ ] ngrok account (free tier works) or similar tunneling service

## Step 1: Local Setup

### 1.1 Install Dependencies
```bash
# Install root dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..
```

### 1.2 Configure Environment
```bash
# Copy environment template
cp ENV_TEMPLATE.txt .env

# Edit .env with your values (we'll fill Shopify values in Step 2)
```

Minimum `.env` configuration needed:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/shopify_reports?schema=public
REDIS_URL=redis://localhost:6379
NODE_ENV=development
PORT=3000
SESSION_SECRET=generate-a-random-string-here
```

### 1.3 Setup Database
```bash
# Generate Prisma client
npm run prisma:generate

# Create database (if needed)
createdb shopify_reports  # PostgreSQL command
# OR use your preferred database tool

# Run migrations
npm run prisma:migrate
```

### 1.4 Verify Services
```bash
# Check PostgreSQL
psql -U postgres -d shopify_reports -c "SELECT 1;"

# Check Redis
redis-cli ping
# Should return: PONG
```

## Step 2: Create Shopify App

### 2.1 Access Partner Dashboard
1. Go to https://partners.shopify.com/
2. Log in or create a free account
3. Click "Apps" in the left sidebar
4. Click "Create app"

### 2.2 Create App
1. Choose "Create app manually"
2. Enter app name: "Sales Report App" (or your choice)
3. App URL: Leave blank for now (we'll update after ngrok)
4. Click "Create app"

### 2.3 Get API Credentials
1. In your app settings, go to "Client credentials"
2. Copy the **API key** and **API secret key**
3. Save these - you'll need them for `.env`

## Step 3: Start ngrok Tunnel

### 3.1 Install ngrok
```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### 3.2 Start Tunnel
```bash
# Start ngrok pointing to your local port 3000
ngrok http 3000
```

### 3.3 Get Your ngrok URL
You'll see output like:
```
Forwarding  https://abc123xyz.ngrok.io -> http://localhost:3000
```

**Copy the HTTPS URL** (e.g., `https://abc123xyz.ngrok.io`)

⚠️ **Important**: If using free ngrok, the URL changes each time you restart. For testing, keep ngrok running.

## Step 4: Configure Shopify App Settings

### 4.1 Update App URLs
In Shopify Partner Dashboard → Your App → App setup:

1. **App URL**: `https://your-ngrok-url.ngrok.io`
2. **Allowed redirection URL(s)**: 
   - `https://your-ngrok-url.ngrok.io/auth/callback`
   - `https://your-ngrok-url.ngrok.io/auth/shopify/callback`

### 4.2 Configure Scopes
In "Configuration" → "Scopes":
- ✅ `read_orders`
- ✅ `read_products`

### 4.3 Update Environment Variables
Update your `.env` file:
```env
SHOPIFY_API_KEY=your_api_key_from_partner_dashboard
SHOPIFY_API_SECRET=your_api_secret_from_partner_dashboard
SHOPIFY_APP_URL=https://your-ngrok-url.ngrok.io
SCOPES=read_orders,read_products
```

## Step 5: Start the Application

### 5.1 Start All Services
Open **3 separate terminals**:

**Terminal 1 - Main Server:**
```bash
npm run dev:server
```
You should see: `Server running on port 3000`

**Terminal 2 - React Client:**
```bash
npm run dev:client
```
You should see Vite dev server starting on port 3001

**Terminal 3 - Background Worker:**
```bash
npm run dev:worker
```
You should see: `Report worker started`

**OR** run all at once:
```bash
npm run dev
```

### 5.2 Verify Everything is Running
- Server: http://localhost:3000 (should respond)
- Client: http://localhost:3001 (should show React app)
- Worker: Check terminal for "Report worker started" message

## Step 6: Install App on Development Store

### 6.1 Get Your Store Domain
From Partner Dashboard → Stores → Your Development Store
Domain format: `your-store-name.myshopify.com`

### 6.2 Install App
Visit this URL in your browser:
```
https://your-ngrok-url.ngrok.io/auth?shop=your-store-name.myshopify.com
```

Replace:
- `your-ngrok-url.ngrok.io` with your actual ngrok URL
- `your-store-name.myshopify.com` with your actual store domain

### 6.3 Complete OAuth Flow
1. You'll be redirected to Shopify
2. Review the permissions (read_orders, read_products)
3. Click "Install app"
4. You'll be redirected back to your app

### 6.4 Access App from Admin
1. Go to your Shopify Admin: `https://your-store-name.myshopify.com/admin`
2. Look for your app in the left sidebar under "Apps"
3. Click on your app name
4. The app should load in the embedded frame

## Step 7: Test Report Generation

### 7.1 Create Test Orders (if needed)
If your dev store has no orders:
1. Go to Products → Add a product
2. Go to Orders → Create order manually
3. Add line items with custom properties (for memo testing)
4. Complete the order

### 7.2 Generate a Report
1. In the app, select a date range that includes your test orders
2. Choose financial status filter (default: Paid & Partially Paid)
3. Click "Generate Report"
4. Watch the job status update:
   - **Queued** → **Running** → **Complete**

### 7.3 Download Reports
1. Once status is "Complete", download buttons appear
2. Click "CSV" to download CSV file
3. Click "PDF" to download PDF file
4. Verify the files contain your order data

### 7.4 Verify Report Content
**CSV should contain:**
- One row per line item
- All required fields (order date, name, customer, line items, etc.)
- Memo field with formatted custom attributes

**PDF should contain:**
- Header with shop name and date range
- Orders grouped by date
- Line items in tables
- Formatted memo fields

## Step 8: Test Edge Cases

### 8.1 Test with No Orders
- Select a date range with no orders
- Generate report
- Should complete successfully with empty report

### 8.2 Test with Large Date Range
- Select a wide date range (e.g., 6 months)
- Generate report
- Should process asynchronously without timeout

### 8.3 Test Memo Formatting
- Create orders with line items that have custom attributes
- Generate report
- Verify memo field formats properties correctly

### 8.4 Test Error Handling
- Stop Redis (worker should handle gracefully)
- Stop database (should show error)
- Invalid date ranges (should validate)

## Troubleshooting

### App Won't Install
- ✅ Check ngrok is running and URL matches `.env`
- ✅ Verify App URL in Partner Dashboard matches ngrok URL exactly
- ✅ Check redirect URLs are configured correctly
- ✅ Ensure API key and secret are correct in `.env`

### OAuth Errors
- ✅ Check `SHOPIFY_APP_URL` in `.env` matches ngrok URL exactly (no trailing slash)
- ✅ Verify redirect URL includes `/auth/callback`
- ✅ Check server logs for specific error messages

### Reports Not Generating
- ✅ Check worker is running (Terminal 3)
- ✅ Verify Redis is running: `redis-cli ping`
- ✅ Check worker terminal for error messages
- ✅ Verify database connection

### GraphQL Errors
- ✅ Ensure app has correct scopes in Partner Dashboard
- ✅ Check shop has granted permissions
- ✅ Verify access token is being stored correctly

### Frontend Not Loading
- ✅ Check client dev server is running (port 3001)
- ✅ Verify Vite proxy is configured correctly
- ✅ Check browser console for errors
- ✅ Ensure React app built: `cd client && npm run build`

### Database Errors
- ✅ Verify PostgreSQL is running
- ✅ Check `DATABASE_URL` is correct
- ✅ Run migrations: `npm run prisma:migrate`
- ✅ Generate Prisma client: `npm run prisma:generate`

## Quick Test Checklist

- [ ] All services running (server, client, worker)
- [ ] ngrok tunnel active
- [ ] App installed on dev store
- [ ] Can access app from Shopify Admin
- [ ] Can generate report for date range with orders
- [ ] CSV downloads successfully
- [ ] PDF downloads successfully
- [ ] Report data is accurate
- [ ] Memo fields format correctly
- [ ] Job status updates in real-time

## Next Steps After Testing

Once testing is successful:
1. Consider setting up a permanent domain (instead of ngrok)
2. Set up production database and Redis
3. Configure file storage (S3 for production)
4. Add error monitoring (Sentry, etc.)
5. Set up CI/CD pipeline
6. Add automated tests

## Getting Help

If you encounter issues:
1. Check server terminal for errors
2. Check worker terminal for errors
3. Check browser console for frontend errors
4. Review Prisma logs for database issues
5. Verify all environment variables are set correctly




