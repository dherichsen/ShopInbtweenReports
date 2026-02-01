# Required Shopify App Scopes

## Required Scopes

### ✅ `read_orders` (REQUIRED)
**Why:** The app fetches order data including:
- Order details (name, ID, dates, status)
- Customer information (name, email)
- Line items with product details
- Custom attributes (line-item properties)
- Pricing information

**Used in:** `server/services/shopifyService.js` - GraphQL orders query

## Optional Scopes

### ⚠️ `read_products` (OPTIONAL)
**Why:** Currently NOT used in the code. The app gets all product information (title, variantTitle, SKU) directly from order line items, so this scope is not required.

**Note:** It's included in the template as a safety measure, but you can remove it if you want to minimize permissions.

## Current Configuration

In your `.env` file:
```env
SCOPES=read_orders,read_products
```

## Minimum Required Configuration

If you want to minimize permissions, you can use:
```env
SCOPES=read_orders
```

This is sufficient for the app to function correctly.

## How to Set Scopes in Partner Dashboard

1. Go to https://partners.shopify.com/
2. Select your app
3. Go to "Configuration" → "Scopes"
4. Enable:
   - ✅ **Read orders** (required)
   - ⚠️ **Read products** (optional - not currently used)

## What Each Scope Allows

### `read_orders`
- Read order information
- Read order line items
- Read customer information from orders
- Read order custom attributes and line-item properties
- Read order financial and fulfillment status

### `read_products` (if included)
- Read product information
- Read product variants
- Read product inventory (if needed later)

## Recommendation

**For MVP/testing:** Use both scopes (`read_orders,read_products`) - it's safer and won't cause issues.

**For production:** You can use just `read_orders` to minimize permissions, since the app doesn't query products directly.




