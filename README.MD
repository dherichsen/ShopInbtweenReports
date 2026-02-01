# Shopify Sales Detail Reporting App

A Shopify embedded app that generates detailed sales reports directly from Shopify orders, including line-item personalization data. Reports can be exported as CSV and PDF.

## Features
- Line-item–level reporting
- Customization memo fields
- Date → Order grouping
- CSV export
- PDF export
- Asynchronous report generation with background jobs
- Secure OAuth authentication
- Job ownership enforcement

## Tech Stack
- Node.js + Express
- @shopify/shopify-api & @shopify/shopify-app-express
- Shopify Admin GraphQL API
- React + Shopify Polaris
- Postgres + Prisma
- Redis + BullMQ
- Playwright (PDF rendering)

## Prerequisites
- Node.js 20+
- PostgreSQL database
- Redis server
- Shopify Partner account
- Development store
- ngrok or similar tunneling service (for local development)

## Setup

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 2. Database Setup

```bash
# Copy environment file
cp .env.example .env

# Edit .env and fill in your configuration:
# - SHOPIFY_API_KEY (from Partner Dashboard)
# - SHOPIFY_API_SECRET (from Partner Dashboard)
# - SHOPIFY_APP_URL (your ngrok URL, e.g., https://abc123.ngrok.io)
# - DATABASE_URL (PostgreSQL connection string)
# - REDIS_URL (Redis connection string, default: redis://localhost:6379)
# - SCOPES (comma-separated, default: read_orders,read_products)

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate
```

### 3. Shopify App Configuration

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com/)
2. Create a new app or select an existing one
3. Configure app settings:
   - App URL: `https://your-ngrok-url.ngrok.io`
   - Allowed redirection URL(s): `https://your-ngrok-url.ngrok.io/auth/callback`
   - Scopes: `read_orders`, `read_products`
4. Copy API Key and API Secret to `.env`

### 4. Start Development Servers

You need to run three processes:

**Terminal 1 - Main Server:**
```bash
npm run dev:server
```

**Terminal 2 - React Client:**
```bash
npm run dev:client
```

**Terminal 3 - Background Worker:**
```bash
npm run dev:worker
```

Or run all three concurrently:
```bash
npm run dev
```

### 5. Install App on Development Store

1. Start your ngrok tunnel pointing to port 3000:
   ```bash
   ngrok http 3000
   ```
2. Update `SHOPIFY_APP_URL` in `.env` with your ngrok URL
3. Visit: `https://your-ngrok-url.ngrok.io/auth?shop=your-dev-store.myshopify.com`
4. Complete OAuth installation

## Quick Start Testing

**For detailed testing instructions, see [TESTING_GUIDE.md](./TESTING_GUIDE.md)**

Quick steps:
1. Set up environment variables (see `.env` template)
2. Install dependencies: `npm install && cd client && npm install && cd ..`
3. Setup database: `npm run prisma:generate && npm run prisma:migrate`
4. Create Shopify app in Partner Dashboard
5. Start ngrok: `ngrok http 3000`
6. Update `.env` with Shopify credentials and ngrok URL
7. Start app: `npm run dev` (runs server, client, and worker)
8. Install app: Visit `https://your-ngrok-url.ngrok.io/auth?shop=your-store.myshopify.com`

## Usage

1. Open the app from your Shopify Admin
2. Select a date range using the date pickers
3. Optionally filter by financial status
4. Click "Generate Report"
5. Wait for the report to process (status updates automatically)
6. Download CSV or PDF when complete

## Project Structure

```
├── server/
│   ├── index.js              # Express server entry point
│   ├── routes/               # API routes
│   ├── controllers/          # Request handlers
│   ├── middleware/           # Auth middleware
│   ├── services/             # Business logic (Shopify, CSV, PDF)
│   ├── workers/              # BullMQ worker for async jobs
│   └── utils/                # Utility functions
├── client/
│   ├── src/
│   │   ├── App.jsx           # Main React component
│   │   └── main.jsx          # React entry point
│   └── package.json
├── prisma/
│   └── schema.prisma         # Database schema
└── reports/                  # Generated report files (gitignored)
```

## API Endpoints

- `POST /api/report-jobs` - Create a new report job
- `GET /api/report-jobs` - List all report jobs for the shop
- `GET /api/report-jobs/:id` - Get a specific report job
- `GET /api/report-jobs/:id/download.csv` - Download CSV report
- `GET /api/report-jobs/:id/download.pdf` - Download PDF report

## Report Format

Reports include the following fields per line item:
- Order Created At
- Order Date (YYYY-MM-DD)
- Order Name (e.g., #20543)
- Order ID
- Customer Name
- Customer Email
- Line Item Title
- Variant Title
- SKU
- Quantity
- Unit Price
- Line Total
- Currency
- Memo (formatted line-item properties)
- Line Item ID

## Memo Field Formatting

Line-item custom attributes are formatted as:
```
First Name: Maya
Background: Swirly Girl
Font: Happy Camper
Outline Style: SOLID
Font Color: Pink
SKU: 00017-NDG
```

## Notes

- Memo fields are derived from line-item properties
- Property formats may vary by personalization app
- Large date ranges may take time to process
- Reports are generated asynchronously via background jobs
- Generated files are stored in the `reports/` directory

## Troubleshooting

**GraphQL errors:** Ensure your app has the correct scopes and the shop has granted permissions.

**Worker not processing jobs:** Check that Redis is running and `REDIS_URL` is correct.

**Database errors:** Verify `DATABASE_URL` is correct and migrations have been run.

**OAuth errors:** Ensure `SHOPIFY_APP_URL` matches your ngrok URL exactly.

## Production Deployment

1. Set up production PostgreSQL and Redis instances
2. Update environment variables
3. Build the React app: `npm run build`
4. Run migrations: `npm run prisma:migrate`
5. Start server: `npm start`
6. Start worker: `npm run worker`
7. Configure your production domain in Shopify Partner Dashboard