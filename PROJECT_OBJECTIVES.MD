# Shopify Sales Detail Reporting App — Project Objectives

## 1. Purpose
Create a Shopify embedded app that generates a detailed sales report directly from Shopify order data, including line-item personalization fields (line item properties), and exports the report as CSV and PDF.

The report is designed to provide an order- and line-item–level view of sales suitable for operations, fulfillment, and internal reporting, with clear grouping and human-readable memo fields.

## 2. Primary Users
- Operations / Fulfillment teams requiring line-item customization details
- Admin / Finance users needing detailed sales exports from Shopify
- Customer support teams referencing exact order customizations

## 3. Core Outcomes
- Generate a report for a selected date range
- Report is line-item level (one row per line item)
- Includes customer, order, SKU, product/variant, quantity, pricing, and memo/customization fields
- Supports grouped view: Date → Order → Line Item
- Export formats:
  - CSV (for spreadsheets and downstream systems)
  - PDF (formatted, grouped, printable)

## 4. In-Scope Features (MVP)
### Reporting
- Date range picker (start date / end date)
- Filters:
  - Financial status (paid, partially_paid, refunded, etc.; default includes paid + partially_paid)
  - Fulfillment status (any)
- Output fields:
  - order_created_at (Shopify order timestamp in shop timezone)
  - order_date (YYYY-MM-DD, shop timezone)
  - order_name (e.g., #20543)
  - order_id
  - customer_name
  - customer_email
  - line_item_title
  - variant_title
  - sku
  - quantity
  - unit_price
  - line_total
  - currency
  - memo (flattened line-item properties)
  - line_item_id

### Memo Formatting
Line-item properties are flattened into a readable multi-line memo string:
First Name: Maya
Background: Swirly Girl
Font: Happy Camper
Outline Style: SOLID
Font Color: Pink
SKU: 00017-NDG


## 5. Explicitly Out of Scope (MVP)
- Syncing or exporting data to external accounting systems
- Posting data to third-party APIs
- Revenue recognition or bookkeeping logic
- Bank payout reconciliation
- Tax filing or accounting-specific reports
- Scheduled email delivery of reports

## 6. Success Criteria
- All orders in the selected date range are included
- Each line item generates exactly one report row
- Memo field accurately reflects line-item properties
- CSV opens cleanly in Excel / Google Sheets
- PDF is readable, grouped, and production-ready
- Large date ranges are processed asynchronously without timeouts

## 7. Non-Functional Requirements
- Shopify embedded app UX
- Secure OAuth-based access
- Minimal persistence (shops + report jobs only)
- Scalable job processing for large order volumes
- Clear error handling and logging

## 8. Risks / Constraints
- Shopify API rate limits
- High-order-volume stores
- Inconsistent line-item property formats across apps
- JSON or encoded values inside properties

## 9. Deliverables
- Shopify embedded app
- CSV export
- PDF export
- Admin UI for report generation
- Clear documentation in repo
