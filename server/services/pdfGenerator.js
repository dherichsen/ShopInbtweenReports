const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs-extra");
const { formatMemo } = require("../utils/memoFormatter");

/**
 * Generate PDF report from orders data
 */
async function generatePdf(orders, shopDomain, startDate, endDate, outputPath) {
  // Ensure directory exists
  await fs.ensureDir(path.dirname(outputPath));

  // Group orders by date
  const ordersByDate = {};
  
  for (const order of orders) {
    const orderDate = new Date(order.createdAt);
    const dateKey = orderDate.toISOString().split("T")[0];
    
    if (!ordersByDate[dateKey]) {
      ordersByDate[dateKey] = [];
    }
    
    ordersByDate[dateKey].push(order);
  }

  // Sort dates
  const sortedDates = Object.keys(ordersByDate).sort();

  // Generate HTML
  const html = generateHtml(ordersByDate, sortedDates, shopDomain, startDate, endDate);

  // Render PDF using Playwright
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.setContent(html, { waitUntil: "networkidle" });
  
  await page.pdf({
    path: outputPath,
    format: "A4",
    margin: {
      top: "20mm",
      right: "15mm",
      bottom: "20mm",
      left: "15mm",
    },
    printBackground: true,
  });

  await browser.close();
  
  return outputPath;
}

/**
 * Generate HTML for PDF
 */
function generateHtml(ordersByDate, sortedDates, shopDomain, startDate, endDate) {
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: 10pt;
          line-height: 1.4;
          color: #333;
        }
        .header {
          margin-bottom: 30px;
          padding-bottom: 15px;
          border-bottom: 2px solid #ddd;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 18pt;
          color: #000;
        }
        .header .meta {
          color: #666;
          font-size: 9pt;
        }
        .date-section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .date-header {
          font-size: 12pt;
          font-weight: bold;
          margin-bottom: 15px;
          color: #000;
          padding: 8px;
          background-color: #f5f5f5;
        }
        .order-section {
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .order-header {
          font-size: 11pt;
          font-weight: bold;
          margin-bottom: 10px;
          color: #333;
        }
        .order-info {
          font-size: 9pt;
          color: #666;
          margin-bottom: 10px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
          font-size: 9pt;
        }
        th {
          background-color: #f8f8f8;
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
          font-weight: bold;
        }
        td {
          border: 1px solid #ddd;
          padding: 8px;
        }
        .memo-cell {
          white-space: pre-wrap;
          font-size: 8pt;
          max-width: 200px;
        }
        .text-right {
          text-align: right;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Sales Detail Report</h1>
        <div class="meta">
          <strong>Shop:</strong> ${escapeHtml(shopDomain)}<br>
          <strong>Date Range:</strong> ${escapeHtml(startDate)} to ${escapeHtml(endDate)}
        </div>
      </div>
  `;

  for (const date of sortedDates) {
    html += `<div class="date-section">`;
    html += `<div class="date-header">${date}</div>`;
    
    const orders = ordersByDate[date];
    for (const order of orders) {
      html += `<div class="order-section">`;
      html += `<div class="order-header">${escapeHtml(order.name)}</div>`;
      html += `<div class="order-info">`;
      html += `Customer: ${escapeHtml(order.customer?.displayName || "N/A")} (${escapeHtml(order.customer?.email || "N/A")})<br>`;
      html += `Status: ${escapeHtml(order.financialStatus)} / ${escapeHtml(order.fulfillmentStatus)}`;
      html += `</div>`;
      
      html += `<table>`;
      html += `<thead><tr>`;
      html += `<th>Item</th>`;
      html += `<th>Variant</th>`;
      html += `<th>SKU</th>`;
      html += `<th class="text-right">Qty</th>`;
      html += `<th class="text-right">Unit Price</th>`;
      html += `<th class="text-right">Total</th>`;
      html += `<th>Memo</th>`;
      html += `</tr></thead>`;
      html += `<tbody>`;
      
      for (const lineItemEdge of order.lineItems.edges) {
        const lineItem = lineItemEdge.node;
        const unitPrice = parseFloat(lineItem.originalUnitPriceSet?.shopMoney?.amount || "0");
        const lineTotal = parseFloat(lineItem.discountedTotalSet?.shopMoney?.amount || "0");
        
        html += `<tr>`;
        html += `<td>${escapeHtml(lineItem.title)}</td>`;
        html += `<td>${escapeHtml(lineItem.variantTitle || "")}</td>`;
        html += `<td>${escapeHtml(lineItem.sku || "")}</td>`;
        html += `<td class="text-right">${lineItem.quantity}</td>`;
        html += `<td class="text-right">${order.currencyCode} ${unitPrice.toFixed(2)}</td>`;
        html += `<td class="text-right">${order.currencyCode} ${lineTotal.toFixed(2)}</td>`;
        html += `<td class="memo-cell">${escapeHtml(formatMemo(lineItem.customAttributes))}</td>`;
        html += `</tr>`;
      }
      
      html += `</tbody></table>`;
      html += `</div>`;
    }
    
    html += `</div>`;
  }

  html += `
    </body>
    </html>
  `;

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

module.exports = {
  generatePdf,
};

