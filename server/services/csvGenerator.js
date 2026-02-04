const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const ExcelJS = require("exceljs");
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
        const memo = formatMemo(lineItem.customAttributes, lineItem.variantTitle);
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
        memo: formatMemo(lineItem.customAttributes, lineItem.variantTitle),
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

/**
 * Format orders into QB Report rows (shared by CSV and XLSX generators)
 * Groups by date with date shown only once per group, and adds totals row after each date
 */
function formatQbReportRows(orders) {
  // Flatten orders into line-item rows for QB format
  const rows = [];
  
  console.log(`🔵 QB REPORT - Formatting: Processing ${orders.length} orders into rows`);
  
  for (const order of orders) {
    const orderDate = new Date(order.createdAt);
    // Format as MM/DD/YYYY for QuickBooks compatibility
    const month = String(orderDate.getMonth() + 1).padStart(2, '0');
    const day = String(orderDate.getDate()).padStart(2, '0');
    const year = orderDate.getFullYear();
    const orderDateStr = `${month}/${day}/${year}`;
    
    // Extract order number from order.name (e.g., "#20551" -> "20551")
    const orderNum = order.name ? order.name.replace(/^#/, '') : '';
    const customerName = order.customer?.displayName || '';
    
    console.log(`🔵 QB REPORT - Formatting: Order ${order.name}, Customer: ${customerName}`);
    
    const lineItemsCount = order.lineItems?.edges?.length || 0;
    console.log(`🔵 QB REPORT - Formatting: Order ${order.name} has ${lineItemsCount} line items`);
    
    if (!order.lineItems || !order.lineItems.edges || order.lineItems.edges.length === 0) {
      console.warn(`⚠️ QB REPORT - Formatting: Order ${order.name} has no line items!`);
      continue;
    }
    
    for (const lineItemEdge of order.lineItems.edges) {
      const lineItem = lineItemEdge.node;
      const memo = formatMemo(lineItem.customAttributes, lineItem.variantTitle);
      
      rows.push({
        date: orderDateStr,
        customer: customerName,
        num: orderNum,
        product_service: lineItem.title,
        qty: lineItem.quantity,
        memo_description: memo,
        sku: lineItem.sku || "",
        vendor: lineItem.vendor || "",
        _orderDate: orderDateStr, // Keep for grouping
        _quantity: lineItem.quantity, // Keep for totals
      });
    }
  }
  
  console.log(`✅ QB REPORT - Formatting: Created ${rows.length} rows from ${orders.length} orders`);

  // Sort by date, then order number, then product
  rows.sort((a, b) => {
    // Parse dates for comparison
    const dateA = new Date(a._orderDate);
    const dateB = new Date(b._orderDate);
    if (dateA.getTime() !== dateB.getTime()) {
      return dateA - dateB;
    }
    // Then by order number
    const numA = parseInt(a.num) || 0;
    const numB = parseInt(b.num) || 0;
    if (numA !== numB) {
      return numA - numB;
    }
    // Then by product name
    return a.product_service.localeCompare(b.product_service);
  });

  // Group by date and format rows (show date only once, add totals row)
  const formattedRows = [];
  let currentDate = null;
  let dateGroupRows = [];
  let dateTotalQty = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // If we've moved to a new date, process the previous date group
    if (currentDate && row._orderDate !== currentDate) {
      // Add all rows for the previous date
      formattedRows.push(...dateGroupRows);
      
      // Add totals row for the previous date
      formattedRows.push({
        date: "",
        customer: `Total orders for ${currentDate}`,
        num: "",
        product_service: "",
        qty: dateTotalQty,
        memo_description: "",
        sku: "",
        vendor: "",
      });
      
      // Reset for new date
      dateGroupRows = [];
      dateTotalQty = 0;
    }
    
    // Set current date if starting a new group
    if (row._orderDate !== currentDate) {
      currentDate = row._orderDate;
    }
    
    // Add row with date shown only if it's the first row of this date group
    const showDate = dateGroupRows.length === 0;
    dateGroupRows.push({
      date: showDate ? row.date : "",
      customer: row.customer,
      num: row.num,
      product_service: row.product_service,
      qty: row.qty,
      memo_description: row.memo_description,
      sku: row.sku,
      vendor: row.vendor,
    });
    
    dateTotalQty += row._quantity;
  }
  
  // Don't forget the last date group
  if (dateGroupRows.length > 0 && currentDate) {
    formattedRows.push(...dateGroupRows);
    formattedRows.push({
      date: "",
      customer: `Total orders for ${currentDate}`,
      num: "",
      product_service: "",
      qty: dateTotalQty,
      memo_description: "",
      sku: "",
      vendor: "",
    });
  }

  return formattedRows;
}

/**
 * Generate QB Report CSV format: Date, Customer, Num, Product/Service, Qty, Memo/Description
 * Groups by date with date shown only once per group, and adds totals row after each date
 */
async function generateQbCsv(orders, outputPath) {
  console.log(`🔵 QB REPORT - CSV Generator: Generating QB CSV with ${orders.length} orders`);
  
  if (orders.length === 0) {
    console.warn(`⚠️ QB REPORT - CSV Generator: WARNING: No orders to generate CSV from!`);
  }
  
  // Ensure directory exists
  await fs.ensureDir(path.dirname(outputPath));

  // Format rows (shared logic)
  const formattedRows = formatQbReportRows(orders);
  console.log(`🔵 QB REPORT - CSV Generator: Generating QB CSV with ${orders.length} orders`);
  
  if (orders.length === 0) {
    console.warn(`⚠️ QB REPORT - CSV Generator: WARNING: No orders to generate CSV from!`);
  }
  

  // Create CSV writer with QB format headers
  const csvWriter = createCsvWriter({
    path: outputPath,
    header: [
      { id: "date", title: "Date" },
      { id: "customer", title: "Customer" },
      { id: "num", title: "Num" },
      { id: "product_service", title: "Product/Service" },
      { id: "qty", title: "Qty" },
      { id: "memo_description", title: "Memo/Description" },
      { id: "sku", title: "SKU" },
      { id: "vendor", title: "Vendor" },
    ],
    encoding: "utf8",
  });

  console.log(`🔵 QB REPORT - CSV Generator: Writing ${formattedRows.length} rows to CSV file: ${outputPath}`);
  await csvWriter.writeRecords(formattedRows);
  console.log(`✅ QB REPORT - CSV Generator: Successfully wrote ${formattedRows.length} rows to QB CSV`);
  
  return outputPath;
}

/**
 * Generate QB Report XLSX format with formatting (wrap text, auto-fit heights)
 */
async function generateQbXlsx(orders, outputPath) {
  console.log(`🔵 QB REPORT - XLSX Generator: Generating XLSX with ${orders.length} orders`);
  
  if (orders.length === 0) {
    console.warn(`⚠️ QB REPORT - XLSX Generator: WARNING: No orders to generate XLSX from!`);
  }
  
  // Ensure directory exists
  await fs.ensureDir(path.dirname(outputPath));

  // Format rows (shared logic)
  const formattedRows = formatQbReportRows(orders);
  
  console.log(`🔵 QB REPORT - XLSX Generator: Formatted ${formattedRows.length} rows`);

  // Create a new workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("QB Report");

  // Define columns
  worksheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Customer", key: "customer", width: 25 },
    { header: "Num", key: "num", width: 10 },
    { header: "Product/Service", key: "product_service", width: 30 },
    { header: "Qty", key: "qty", width: 8 },
    { header: "Memo/Description", key: "memo_description", width: 50 },
    { header: "SKU", key: "sku", width: 15 },
    { header: "Vendor", key: "vendor", width: 20 },
  ];

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };
  worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  // Add rows
  formattedRows.forEach((row) => {
    const worksheetRow = worksheet.addRow(row);
    
    // Check if this is a totals row
    const isTotalsRow = row.customer && row.customer.startsWith("Total orders for");
    
    if (isTotalsRow) {
      // Style totals rows
      worksheetRow.font = { bold: true };
      worksheetRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0F0F0" },
      };
    }
    
    // Set wrap text for memo/description column (column 6, index 6)
    worksheetRow.getCell(6).alignment = {
      wrapText: true,
      vertical: "top",
    };
    
    // Set alignment for other columns
    worksheetRow.getCell(1).alignment = { vertical: "top" }; // Date
    worksheetRow.getCell(2).alignment = { vertical: "top" }; // Customer
    worksheetRow.getCell(3).alignment = { vertical: "top", horizontal: "center" }; // Num
    worksheetRow.getCell(4).alignment = { vertical: "top" }; // Product/Service
    worksheetRow.getCell(5).alignment = { vertical: "top", horizontal: "right" }; // Qty
    worksheetRow.getCell(7).alignment = { vertical: "top" }; // SKU
    worksheetRow.getCell(8).alignment = { vertical: "top" }; // Vendor
  });

  // Auto-fit row heights (with minimum height)
  worksheet.eachRow((row, rowNumber) => {
    // Calculate height based on content, especially for memo column
    const memoCell = row.getCell(6);
    const memoText = memoCell.value ? String(memoCell.value) : "";
    const lineCount = memoText.split("\n").length;
    const minHeight = 15;
    const calculatedHeight = Math.max(minHeight, lineCount * 15);
    row.height = calculatedHeight;
  });

  // Save the workbook
  console.log(`🔵 QB REPORT - XLSX Generator: Writing ${formattedRows.length} rows to XLSX file: ${outputPath}`);
  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ QB REPORT - XLSX Generator: Successfully wrote ${formattedRows.length} rows to QB XLSX`);
  
  return outputPath;
}

/**
 * Format shipping address into multi-line string
 */
function formatAddress(shippingAddress) {
  if (!shippingAddress) {
    console.log(`⚠️ formatAddress: shippingAddress is null/undefined`);
    return "";
  }
  
  console.log(`🔵 formatAddress: Received shippingAddress:`, JSON.stringify(shippingAddress, null, 2));
  
  const parts = [];
  if (shippingAddress.name) parts.push(shippingAddress.name);
  if (shippingAddress.address1) parts.push(shippingAddress.address1);
  if (shippingAddress.address2) parts.push(shippingAddress.address2);
  
  const cityStateZip = [];
  if (shippingAddress.city) cityStateZip.push(shippingAddress.city);
  if (shippingAddress.province) cityStateZip.push(shippingAddress.province);
  if (shippingAddress.zip) cityStateZip.push(shippingAddress.zip);
  
  if (cityStateZip.length > 0) {
    parts.push(cityStateZip.join(", "));
  }
  
  const formatted = parts.join("\n");
  console.log(`🔵 formatAddress: Formatted address:`, formatted || "(empty)");
  return formatted;
}

/**
 * Format Internal Vendors rows (shared by CSV and XLSX generators)
 */
function formatInternalVendorsRows(orders) {
  const rows = [];
  
  console.log(`🔵 INTERNAL VENDORS - Formatting: Processing ${orders.length} orders into rows`);
  
  for (const order of orders) {
    const orderDate = new Date(order.createdAt);
    // Format as MM/DD/YYYY
    const month = String(orderDate.getMonth() + 1).padStart(2, '0');
    const day = String(orderDate.getDate()).padStart(2, '0');
    const year = orderDate.getFullYear();
    const orderDateStr = `${month}/${day}/${year}`;
    
    // Extract order number from order.name (e.g., "#20551" -> "20551")
    const orderNum = order.name ? order.name.replace(/^#/, '') : '';
    const customerName = order.customer?.displayName || '';
    
    // Debug shipping address - check multiple possible field names
    console.log(`🔵 INTERNAL VENDORS - Order ${order.name} full order keys:`, Object.keys(order));
    console.log(`🔵 INTERNAL VENDORS - Order ${order.name} shippingAddress:`, JSON.stringify(order.shippingAddress, null, 2));
    console.log(`🔵 INTERNAL VENDORS - Order ${order.name} shipping_address:`, JSON.stringify(order.shipping_address, null, 2));
    
    // Try to get shipping address - it might be null for digital/unfulfilled orders
    const shippingAddress = order.shippingAddress || order.shipping_address || null;
    const address = formatAddress(shippingAddress);
    console.log(`🔵 INTERNAL VENDORS - Order ${order.name} final formatted address:`, address || "(empty - no shipping address)");
    
    const lineItemsCount = order.lineItems?.edges?.length || 0;
    console.log(`🔵 INTERNAL VENDORS - Formatting: Order ${order.name} has ${lineItemsCount} line items`);
    
    if (!order.lineItems || !order.lineItems.edges || order.lineItems.edges.length === 0) {
      console.warn(`⚠️ INTERNAL VENDORS - Formatting: Order ${order.name} has no line items!`);
      continue;
    }
    
    for (const lineItemEdge of order.lineItems.edges) {
      const lineItem = lineItemEdge.node;
      const vendor = lineItem.vendor || "";
      const memo = formatMemo(lineItem.customAttributes, lineItem.variantTitle);
      
      // Memo/Description: "Vendor:Product" format
      const memoDescription = vendor ? `${vendor}:${lineItem.title}` : lineItem.title;
      
      // Product/Service: Product name + customization details
      const productService = lineItem.title + (memo ? "\n" + memo : "") + (lineItem.sku ? "\nSKU: " + lineItem.sku : "");
      
      rows.push({
        address: address,
        drop_ship: "", // Leave empty
        date: orderDateStr,
        customer: customerName,
        num: orderNum,
        memo_description: memoDescription,
        qty: lineItem.quantity,
        product_service: productService,
        empty: "", // Empty column
        vendor: vendor, // Vendor column
      });
    }
  }
  
  console.log(`✅ INTERNAL VENDORS - Formatting: Created ${rows.length} rows from ${orders.length} orders`);

  // Sort by date, then order number
  rows.sort((a, b) => {
    // Parse MM/DD/YYYY format dates
    const parseDate = (dateStr) => {
      if (!dateStr) return new Date(0);
      const [month, day, year] = dateStr.split('/');
      return new Date(year, month - 1, day);
    };
    
    const dateA = parseDate(a.date);
    const dateB = parseDate(b.date);
    if (dateA.getTime() !== dateB.getTime()) {
      return dateA - dateB;
    }
    const numA = parseInt(a.num) || 0;
    const numB = parseInt(b.num) || 0;
    return numA - numB;
  });

  return rows;
}

/**
 * Generate Internal Vendors Report CSV format
 * Columns: ADDRESS, DROP SHIP (Y or N), Date, Customer, Num, Memo/Description, Qty, Product/Service, (empty), CUSTOMER NOTE
 */
async function generateInternalVendorsCsv(orders, outputPath) {
  console.log(`🔵 INTERNAL VENDORS - CSV Generator: Generating Internal Vendors CSV with ${orders.length} orders`);
  
  if (orders.length === 0) {
    console.warn(`⚠️ INTERNAL VENDORS - CSV Generator: WARNING: No orders to generate CSV from!`);
  }
  
  // Ensure directory exists
  await fs.ensureDir(path.dirname(outputPath));

  // Format rows (shared logic)
  const rows = formatInternalVendorsRows(orders);

  // Create CSV writer with Internal Vendors format headers
  const csvWriter = createCsvWriter({
    path: outputPath,
    header: [
      { id: "address", title: "ADDRESS" },
      { id: "drop_ship", title: "DROP SHIP (Y or N)" },
      { id: "date", title: "Date" },
      { id: "customer", title: "Customer" },
      { id: "num", title: "Num" },
      { id: "memo_description", title: "Memo/Description" },
      { id: "qty", title: "Qty" },
      { id: "product_service", title: "Product/Service" },
      { id: "empty", title: "" },
      { id: "vendor", title: "Vendor" },
    ],
    encoding: "utf8",
  });

  console.log(`🔵 INTERNAL VENDORS - CSV Generator: Writing ${rows.length} rows to CSV file: ${outputPath}`);
  await csvWriter.writeRecords(rows);
  console.log(`✅ INTERNAL VENDORS - CSV Generator: Successfully wrote ${rows.length} rows to Internal Vendors CSV`);
  
  return outputPath;
}

/**
 * Generate Internal Vendors Report XLSX format with formatting
 */
async function generateInternalVendorsXlsx(orders, outputPath) {
  console.log(`🔵 INTERNAL VENDORS - XLSX Generator: Generating Internal Vendors XLSX with ${orders.length} orders`);
  
  if (orders.length === 0) {
    console.warn(`⚠️ INTERNAL VENDORS - XLSX Generator: WARNING: No orders to generate XLSX from!`);
  }
  
  // Ensure directory exists
  await fs.ensureDir(path.dirname(outputPath));

  // Format rows (shared logic)
  const rows = formatInternalVendorsRows(orders);
  
  console.log(`🔵 INTERNAL VENDORS - XLSX Generator: Formatted ${rows.length} rows`);

  // Create a new workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Internal Vendors");

  // Define columns
  worksheet.columns = [
    { header: "ADDRESS", key: "address", width: 30 },
    { header: "DROP SHIP (Y or N)", key: "drop_ship", width: 15 },
    { header: "Date", key: "date", width: 12 },
    { header: "Customer", key: "customer", width: 25 },
    { header: "Num", key: "num", width: 10 },
    { header: "Memo/Description", key: "memo_description", width: 30 },
    { header: "Qty", key: "qty", width: 8 },
    { header: "Product/Service", key: "product_service", width: 50 },
    { header: "", key: "empty", width: 10 },
    { header: "Vendor", key: "vendor", width: 20 },
  ];

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };
  worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  // Add rows
  rows.forEach((row) => {
    const worksheetRow = worksheet.addRow(row);
    
    // Set wrap text for address and product/service columns
    worksheetRow.getCell(1).alignment = { wrapText: true, vertical: "top" }; // ADDRESS
    worksheetRow.getCell(6).alignment = { wrapText: true, vertical: "top" }; // Memo/Description
    worksheetRow.getCell(8).alignment = { wrapText: true, vertical: "top" }; // Product/Service
    
    // Set alignment for other columns
    worksheetRow.getCell(2).alignment = { vertical: "top" }; // DROP SHIP
    worksheetRow.getCell(3).alignment = { vertical: "top" }; // Date
    worksheetRow.getCell(4).alignment = { vertical: "top" }; // Customer
    worksheetRow.getCell(5).alignment = { vertical: "top", horizontal: "center" }; // Num
    worksheetRow.getCell(7).alignment = { vertical: "top", horizontal: "right" }; // Qty
    worksheetRow.getCell(9).alignment = { vertical: "top" }; // Empty
    worksheetRow.getCell(10).alignment = { vertical: "top" }; // Vendor
  });

  // Auto-fit row heights (with minimum height)
  worksheet.eachRow((row, rowNumber) => {
    // Calculate height based on content, especially for address and product/service columns
    const addressCell = row.getCell(1);
    const productCell = row.getCell(8);
    const addressText = addressCell.value ? String(addressCell.value) : "";
    const productText = productCell.value ? String(productCell.value) : "";
    const addressLines = addressText.split("\n").length;
    const productLines = productText.split("\n").length;
    const maxLines = Math.max(addressLines, productLines);
    const minHeight = 15;
    const calculatedHeight = Math.max(minHeight, maxLines * 15);
    row.height = calculatedHeight;
  });

  // Save the workbook
  console.log(`🔵 INTERNAL VENDORS - XLSX Generator: Writing ${rows.length} rows to XLSX file: ${outputPath}`);
  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ INTERNAL VENDORS - XLSX Generator: Successfully wrote ${rows.length} rows to Internal Vendors XLSX`);
  
  return outputPath;
}

module.exports = {
  generateCsv,
  generateQbCsv,
  generateQbXlsx,
  generateInternalVendorsCsv,
  generateInternalVendorsXlsx,
};

