// Import adapter FIRST before any shopify-api usage
require("@shopify/shopify-api/adapters/node");

const { Worker } = require("bullmq");
const Redis = require("ioredis");
const { PrismaClient } = require("@prisma/client");
const path = require("path");
const { fetchOrders } = require("../services/shopifyService");
const { generateCsv, generateQbCsv, generateQbXlsx, generateInternalVendorsCsv, generateInternalVendorsXlsx } = require("../services/csvGenerator");
const { generatePdf } = require("../services/pdfGenerator");

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null, // Required for BullMQ
});

/**
 * BullMQ worker for processing report generation jobs
 */
const worker = new Worker(
  "report-generation",
  async (job) => {
    const { jobId, shopId, params } = job.data;
    const { startDate, endDate, financialStatus, fulfillmentStatus, reportType } = params;

    try {
      // Update job status to RUNNING
      await prisma.reportJob.update({
        where: { id: jobId },
        data: { status: "RUNNING" },
      });

      // Get shop info
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
      });

      if (!shop) {
        throw new Error("Shop not found");
      }

      // Fetch orders from Shopify
      console.log(`🟣 [WORKER] Fetching orders for shop ${shop.shopDomain}...`);
      console.log(`🟣 [WORKER] Parameters:`, {
        startDate,
        endDate,
        financialStatus,
        fulfillmentStatus,
      });
      
      const orders = await fetchOrders(
        shop.accessToken,
        shop.shopDomain,
        startDate,
        endDate,
        financialStatus,
        fulfillmentStatus
      );

      console.log(`✅ ORDERS - Worker fetched ${orders.length} orders`);
      
      if (orders.length === 0) {
        console.warn(`⚠️ ORDERS - No orders found! Check date range and filters.`);
        console.warn(`⚠️ ORDERS - Date range: ${startDate} to ${endDate}`);
        console.warn(`⚠️ ORDERS - Financial status filter:`, financialStatus);
        console.warn(`⚠️ ORDERS - Fulfillment status filter:`, fulfillmentStatus);
      } else {
        console.log(`✅ ORDERS - First order sample:`, JSON.stringify(orders[0], null, 2));
        console.log(`✅ ORDERS - Order keys:`, Object.keys(orders[0]));
      }

      // Generate reports directory
      const reportsDir = path.join(__dirname, "../../reports");
      await require("fs-extra").ensureDir(reportsDir);

      // Generate reports based on report type
      const isQbReport = reportType === "qb";
      const isInternalVendorsReport = reportType === "internal_vendors";
      
      let relativeCsvPath = null;
      let relativeXlsxPath = null;
      let relativePdfPath = null;
      
      if (isQbReport) {
        // QB Report: CSV + XLSX
        console.log("Generating QB CSV...");
        const csvPath = path.join(reportsDir, `${jobId}.csv`);
        await generateQbCsv(orders, csvPath);
        relativeCsvPath = `reports/${jobId}.csv`;
        
        console.log("Generating QB XLSX...");
        const xlsxPath = path.join(reportsDir, `${jobId}.xlsx`);
        await generateQbXlsx(orders, xlsxPath);
        relativeXlsxPath = `reports/${jobId}.xlsx`;
      } else if (isInternalVendorsReport) {
        // Internal Vendors: CSV + XLSX
        console.log("Generating Internal Vendors CSV...");
        const csvPath = path.join(reportsDir, `${jobId}.csv`);
        await generateInternalVendorsCsv(orders, csvPath);
        relativeCsvPath = `reports/${jobId}.csv`;
        
        console.log("Generating Internal Vendors XLSX...");
        const xlsxPath = path.join(reportsDir, `${jobId}.xlsx`);
        await generateInternalVendorsXlsx(orders, xlsxPath);
        relativeXlsxPath = `reports/${jobId}.xlsx`;
      } else {
        // Standard Report: CSV + PDF
        console.log("Generating standard CSV...");
        const csvPath = path.join(reportsDir, `${jobId}.csv`);
        await generateCsv(orders, csvPath);
        relativeCsvPath = `reports/${jobId}.csv`;
        
        console.log("Generating PDF...");
        const pdfPath = path.join(reportsDir, `${jobId}.pdf`);
        await generatePdf(orders, shop.shopDomain, startDate, endDate, pdfPath);
        relativePdfPath = `reports/${jobId}.pdf`;
      }

      // Update job status to COMPLETE
      await prisma.reportJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETE",
          csvPath: relativeCsvPath,
          pdfPath: relativePdfPath,
          xlsxPath: relativeXlsxPath,
        },
      });

      console.log(`Report generation complete for job ${jobId}`);
      
      return { success: true, ordersCount: orders.length };
    } catch (error) {
      console.error(`Error processing report job ${jobId}:`, error);
      
      // Update job status to FAILED
      await prisma.reportJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          errorMessage: error.message,
        },
      });

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 2, // Process 2 jobs at a time
  }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

console.log("Report worker started");

// Graceful shutdown
process.on("SIGTERM", async () => {
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

