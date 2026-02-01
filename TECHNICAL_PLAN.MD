# Technical Plan — Shopify Sales Detail Reporting App

## 1. Architecture Overview
- Shopify embedded app
- Backend API (Node.js + Express)
- Background job processor for report generation
- Database for shops and report jobs
- Server-side CSV and PDF generation

## 2. Recommended Stack
- Node.js 20+
- @shopify/shopify-api (Express app)
- React + Shopify Polaris (embedded admin UI)
- Postgres + Prisma (persistence)
- Redis + BullMQ (async jobs)
- Playwright (HTML-to-PDF rendering)

## 3. Data Model
### Shop
- id (uuid)
- shop_domain (unique)
- access_token
- installed_at

### ReportJob
- id (uuid)
- shop_id
- status (queued | running | complete | failed)
- params_json (date range, filters, formats)
- csv_path
- pdf_path
- error_message
- created_at
- updated_at

## 4. Shopify Data Access
Use Shopify Admin GraphQL API to fetch orders.

Required fields:
- order id, name, createdAt, currencyCode
- customer displayName, email
- financialStatus, fulfillmentStatus
- lineItems:
  - id
  - title
  - variantTitle
  - sku
  - quantity
  - originalUnitPriceSet
  - discountedTotalSet
  - customAttributes (line-item properties)

## 5. Report Generation Logic
### Normalize Orders
Each line item becomes one report row.

### Memo Formatter
- Remove empty values
- Normalize key names
- Attempt JSON parsing on values
- Stable key ordering:
  - Known personalization keys first
  - Remaining keys alphabetically
- Multi-line string output

### CSV
- Stream rows to file
- UTF-8 encoding
- Deterministic column order

### PDF
- Generate HTML with:
  - Header (shop name, date range)
  - Grouping by date, then order
  - Line-item tables per order
- Render PDF using Playwright

## 6. Job Processing
- Asynchronous processing for large datasets
- Job status polling
- Safe retries and error handling

## 7. API Endpoints
- POST /api/report-jobs
- GET /api/report-jobs/:id
- GET /api/report-jobs/:id/download.csv
- GET /api/report-jobs/:id/download.pdf

## 8. Security
- Validate Shopify session
- Ensure job ownership per shop
- Protect report downloads
- Short-lived file retention

## 9. Testing
- Unit tests for memo formatter
- Integration tests for order pagination
- End-to-end test for report generation

## 10. Deployment
- Single service for MVP
- Separate worker optional
- Local file storage (S3 optional later)
