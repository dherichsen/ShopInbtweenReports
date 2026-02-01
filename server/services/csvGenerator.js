const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const path = require("path");
const fs = require("fs-extra");
const { formatMemo } = require("../utils/memoFormatter");

/**
 * Generate CSV report from orders data
 */
async function generateCsv(orders, outputPath) {
  console.log(`🔵 ORDERS - CSV Generator: Generating CSV with ${orders.length} orders`);
  
  if (orders.length === 0) {
    console.warn(`⚠️ ORDERS - CSV Generator: WARNING: No orders to generate CSV from!`);
    console.warn(`⚠️ ORDERS - CSV Generator: This will create an empty CSV file.`);
  } else {
    console.log(`✅ ORDERS - CSV Generator: Sample order structure:`, JSON.stringify(orders[0], null, 2));
    console.log(`✅ ORDERS - CSV Generator: Order has lineItems:`, !!orders[0].lineItems);
    console.log(`✅ ORDERS - CSV Generator: LineItems type:`, typeof orders[0].lineItems);
    console.log(`✅ ORDERS - CSV Generator: LineItems keys:`, orders[0].lineItems ? Object.keys(orders[0].lineItems) : []);
  }
  // Ensure directory exists
  await fs.ensureDir(path.dirname(outputPath));

  // Flatten orders into line-item rows
  const rows = [];
  
  console.log(`🔵 ORDERS - CSV Generator: Processing ${orders.length} orders into rows`);
  
  for (const order of orders) {
    const orderDate = new Date(order.createdAt);
    const orderDateStr = orderDate.toISOString().split("T")[0];
    
    const lineItemsCount = order.lineItems?.edges?.length || 0;
    console.log(`🔵 ORDERS - CSV Generator: Order ${order.name} has ${lineItemsCount} line items`);
    
    if (!order.lineItems || !order.lineItems.edges || order.lineItems.edges.length === 0) {
      console.warn(`⚠️ ORDERS - CSV Generator: Order ${order.name} has no line items!`);
      continue;
    }
    
    for (const lineItemEdge of order.lineItems.edges) {
      const lineItem = lineItemEdge.node;
      const unitPrice = parseFloat(lineItem.originalUnitPriceSet?.shopMoney?.amount || "0");
      const lineTotal = parseFloat(lineItem.discountedTotalSet?.shopMoney?.amount || "0");
      
      // Log custom attributes for debugging
      if (lineItem.customAttributes && lineItem.customAttributes.length > 0) {
        console.log(`🔵 ORDERS - CSV Generator: Line item ${lineItem.title} has ${lineItem.customAttributes.length} custom attributes:`, 
          JSON.stringify(lineItem.customAttributes, null, 2));
        const memo = formatMemo(lineItem.customAttributes);
        console.log(`🔵 ORDERS - CSV Generator: Formatted memo (${memo.length} chars):`, memo.substring(0, 200));
      }
      
      rows.push({
        order_created_at: order.createdAt,
        order_date: orderDateStr,
        order_name: order.name,
        order_id: order.id,
        customer_name: order.customer?.displayName || "",
        customer_email: order.customer?.email || "",
        line_item_title: lineItem.title,
        variant_title: lineItem.variantTitle || "",
        sku: lineItem.sku || "",
        quantity: lineItem.quantity,
        unit_price: unitPrice.toFixed(2),
        line_total: lineTotal.toFixed(2),
        currency: order.currencyCode,
        memo: formatMemo(lineItem.customAttributes),
        line_item_id: lineItem.id,
      });
    }
  }
  
  console.log(`✅ ORDERS - CSV Generator: Created ${rows.length} rows from ${orders.length} orders`);

  // Sort by date, then order name, then line item
  rows.sort((a, b) => {
    if (a.order_date !== b.order_date) {
      return a.order_date.localeCompare(b.order_date);
    }
    if (a.order_name !== b.order_name) {
      return a.order_name.localeCompare(b.order_name);
    }
    return a.line_item_id.localeCompare(b.line_item_id);
  });

  // Create CSV writer
  const csvWriter = createCsvWriter({
    path: outputPath,
    header: [
      { id: "order_created_at", title: "Order Created At" },
      { id: "order_date", title: "Order Date" },
      { id: "order_name", title: "Order Name" },
      { id: "order_id", title: "Order ID" },
      { id: "customer_name", title: "Customer Name" },
      { id: "customer_email", title: "Customer Email" },
      { id: "line_item_title", title: "Line Item Title" },
      { id: "variant_title", title: "Variant Title" },
      { id: "sku", title: "SKU" },
      { id: "quantity", title: "Quantity" },
      { id: "unit_price", title: "Unit Price" },
      { id: "line_total", title: "Line Total" },
      { id: "currency", title: "Currency" },
      { id: "memo", title: "Memo" },
      { id: "line_item_id", title: "Line Item ID" },
    ],
    encoding: "utf8",
  });

  console.log(`🔵 ORDERS - CSV Generator: Writing ${rows.length} rows to CSV file: ${outputPath}`);
  await csvWriter.writeRecords(rows);
  console.log(`✅ ORDERS - CSV Generator: Successfully wrote ${rows.length} rows to CSV`);
  
  return outputPath;
}

module.exports = {
  generateCsv,
};

