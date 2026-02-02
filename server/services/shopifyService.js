// Import adapter FIRST before any shopify-api usage
require("@shopify/shopify-api/adapters/node");

const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");

/**
 * GraphQL query to fetch orders with line items and custom attributes
 */
const ORDERS_QUERY = `
  query getOrders($first: Int!, $after: String, $query: String!) {
    orders(first: $first, after: $after, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          createdAt
          currencyCode
          displayFinancialStatus
          displayFulfillmentStatus
          customer {
            displayName
            email
          }
          shippingAddress {
            name
            address1
            address2
            city
            province
            zip
            country
          }
          lineItems(first: 250) {
            edges {
              node {
                id
                title
                variantTitle
                sku
                quantity
                vendor
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                discountedTotalSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                customAttributes {
                  key
                  value
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Fetch all orders for a date range
 */
async function fetchOrders(accessToken, shopDomain, startDate, endDate, financialStatus, fulfillmentStatus) {
  const shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SCOPES?.split(",") || ["read_orders", "read_products", "read_customers"],
    hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, "") || "localhost:3000",
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
  });

  const session = {
    shop: shopDomain,
    accessToken,
  };

  console.log(`🔵 ORDERS - Fetching orders for shop: ${shopDomain}`);
  console.log(`🔵 ORDERS - Date range: ${startDate} to ${endDate}`);
  console.log(`🔵 ORDERS - Financial status:`, financialStatus);
  console.log(`🔵 ORDERS - Fulfillment status:`, fulfillmentStatus);

  const client = new shopify.clients.Graphql({ session });

  // Build query string - Shopify expects dates in format: YYYY-MM-DD
  // Format dates properly for Shopify query
  const startDateFormatted = startDate.split("T")[0]; // Just the date part
  const endDateFormatted = endDate.split("T")[0]; // Just the date part
  
  // Build date query - use proper Shopify date format
  let query = `created_at:>='${startDateFormatted}' AND created_at:<='${endDateFormatted}'`;
  
  if (financialStatus && financialStatus.length > 0 && !financialStatus.includes("any")) {
    const statusQuery = financialStatus.map(s => `financial_status:${s.toUpperCase()}`).join(" OR ");
    query += ` AND (${statusQuery})`;
  }
  
  if (fulfillmentStatus) {
    query += ` AND fulfillment_status:${fulfillmentStatus.toUpperCase()}`;
  }

  console.log(`🔵 ORDERS - Query string: ${query}`);
  console.log(`🔵 ORDERS - Date range: ${startDateFormatted} to ${endDateFormatted}`);
  
  // If no financial status filter, try without it to see if we get any orders
  if (!financialStatus || financialStatus.length === 0 || financialStatus.includes("any")) {
    console.log(`🔵 ORDERS - No financial status filter - querying all orders in date range`);
  }

  const allOrders = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const variables = {
      first: 50,
      after: cursor,
      query,
    };

    console.log(`🔵 ORDERS - Making GraphQL request with variables:`, JSON.stringify(variables, null, 2));

    try {
      // GraphQL client.request format for shopify-api
      const response = await client.request(ORDERS_QUERY, { variables });

      console.log(`🔵 ORDERS - Response type:`, typeof response);
      console.log(`🔵 ORDERS - Response keys:`, Object.keys(response || {}));
      console.log(`🔵 ORDERS - Full response:`, JSON.stringify(response, null, 2));
      
      // shopify-api GraphQL client returns data directly or in response.body or response.data
      const orders = response?.body?.data?.orders || 
                    response?.data?.orders ||
                    response?.orders;
      
      console.log(`🔵 ORDERS - Parsed orders object:`, orders ? 'EXISTS' : 'NULL');
      console.log(`🔵 ORDERS - Orders type:`, typeof orders);
      console.log(`🔵 ORDERS - Orders keys:`, orders ? Object.keys(orders) : []);
      
      if (!orders) {
        console.error(`❌ ORDERS - No orders in response!`);
        console.error(`❌ ORDERS - Response structure:`, {
          hasBody: !!response.body,
          hasData: !!response.body?.data,
          hasDirectData: !!response.data,
          dataKeys: response.body?.data ? Object.keys(response.body.data) : [],
          directDataKeys: response.data ? Object.keys(response.data) : [],
          errors: response.body?.errors || response.errors,
        });
        break;
      }

      console.log(`✅ ORDERS - Orders object found!`);
      console.log(`✅ ORDERS - Orders structure:`, JSON.stringify(orders, null, 2));
      console.log(`✅ ORDERS - Has edges:`, !!orders.edges);
      console.log(`✅ ORDERS - Edges length:`, orders.edges?.length || 0);
      console.log(`✅ ORDERS - Page info:`, orders.pageInfo);

      if (orders.edges && orders.edges.length > 0) {
        const orderNodes = orders.edges.map(edge => edge.node);
        console.log(`✅ ORDERS - Adding ${orderNodes.length} orders to results`);
        console.log(`✅ ORDERS - First order sample:`, JSON.stringify(orderNodes[0], null, 2));
        console.log(`✅ ORDERS - First order shippingAddress:`, JSON.stringify(orderNodes[0]?.shippingAddress, null, 2));
        allOrders.push(...orderNodes);
      } else {
        console.log(`⚠️ ORDERS - No orders in edges array`);
        console.log(`⚠️ ORDERS - Edges value:`, orders.edges);
      }

      hasNextPage = orders.pageInfo.hasNextPage;
      cursor = orders.pageInfo.endCursor;
    } catch (error) {
      console.error(`❌ ORDERS - GraphQL request error:`, error);
      console.error(`❌ ORDERS - Error response body:`, JSON.stringify(error.response?.body || error.body || {}, null, 2));
      console.error(`❌ ORDERS - Error details:`, {
        message: error.message,
        code: error.code,
        body: error.body,
        response: error.response,
      });
      throw error;
    }
  }

  console.log(`✅ ORDERS - Total orders fetched: ${allOrders.length}`);
  return allOrders;
}

module.exports = {
  fetchOrders,
};

