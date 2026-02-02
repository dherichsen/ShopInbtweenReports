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
console.log("🟠 [WORKER] Prisma client created");

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null, // Required for BullMQ
});

redis.on("connect", () => {
  console.log("🟠 [WORKER] Redis connected successfully");
});

redis.on("error", (err) => {
  console.error("❌ [WORKER] Redis connection error:", err);
});

console.log("🟠 [WORKER] Redis client created, connecting to:", process.env.REDIS_URL ? "REDIS_URL from env" : "localhost:6379");

/**
 * BullMQ worker for processing report generation jobs
 */
const worker = new Worker(
  "report-generation",
  async (job) => {
    console.log(`🟠 [WORKER] Job received:`, { jobId: job.id, data: job.data });
    const { jobId, shopId, params } = job.data;
    const { startDate, endDate, financialStatus, fulfillmentStatus, reportType } = params;

    console.log(`🟠 [WORKER] Processing job ${jobId} for shop ${shopId}`);
    console.log(`🟠 [WORKER] Params:`, { startDate, endDate, financialStatus, fulfillmentStatus, reportType });

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

      // Get access token from Session table (more reliable than Shop table)
      const session = await prisma.session.findFirst({
        where: {
          shop: {
            equals: shop.shopDomain,
            mode: 'insensitive'
          }
        }
      });

      if (!session || !session.accessToken) {
        throw new Error(`No valid session found for shop: ${shop.shopDomain}. Please reinstall the app.`);
      }

      const accessToken = session.accessToken;
      console.log(`🟣 [WORKER] Using access token from session for ${shop.shopDomain}`);
      console.log(`🟣 [WORKER] Token length: ${accessToken.length}, prefix: ${accessToken.substring(0, 6)}...`);

      // Fetch orders from Shopify
      console.log(`🟣 [WORKER] Fetching orders for shop ${shop.shopDomain}...`);
      console.log(`🟣 [WORKER] Parameters:`, {
        startDate,
        endDate,
        financialStatus,
        fulfillmentStatus,
      });
      
      const orders = await fetchOrders(
        accessToken,
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
      
      let csvData = null;
      let xlsxData = null;
      let pdfData = null;
      
      const fs = require("fs-extra");
      
      if (isQbReport) {
        // QB Report: CSV + XLSX
        console.log("Generating QB CSV...");
        const csvPath = path.join(reportsDir, `${jobId}.csv`);
        await generateQbCsv(orders, csvPath);
        csvData = await fs.readFile(csvPath);
        
        console.log("Generating QB XLSX...");
        const xlsxPath = path.join(reportsDir, `${jobId}.xlsx`);
        await generateQbXlsx(orders, xlsxPath);
        xlsxData = await fs.readFile(xlsxPath);
        
        // Clean up temp files
        await fs.remove(csvPath).catch(() => {});
        await fs.remove(xlsxPath).catch(() => {});
      } else if (isInternalVendorsReport) {
        // Internal Vendors: CSV + XLSX
        console.log("Generating Internal Vendors CSV...");
        const csvPath = path.join(reportsDir, `${jobId}.csv`);
        await generateInternalVendorsCsv(orders, csvPath);
        csvData = await fs.readFile(csvPath);
        
        console.log("Generating Internal Vendors XLSX...");
        const xlsxPath = path.join(reportsDir, `${jobId}.xlsx`);
        await generateInternalVendorsXlsx(orders, xlsxPath);
        xlsxData = await fs.readFile(xlsxPath);
        
        // Clean up temp files
        await fs.remove(csvPath).catch(() => {});
        await fs.remove(xlsxPath).catch(() => {});
      } else {
        // Standard Report: CSV + PDF
        console.log("Generating standard CSV...");
        const csvPath = path.join(reportsDir, `${jobId}.csv`);
        await generateCsv(orders, csvPath);
        csvData = await fs.readFile(csvPath);
        
        console.log("Generating PDF...");
        const pdfPath = path.join(reportsDir, `${jobId}.pdf`);
        await generatePdf(orders, shop.shopDomain, startDate, endDate, pdfPath);
        pdfData = await fs.readFile(pdfPath);
        
        // Clean up temp files
        await fs.remove(csvPath).catch(() => {});
        await fs.remove(pdfPath).catch(() => {});
      }

      // Update job status to COMPLETE - store data in database
      await prisma.reportJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETE",
          csvData: csvData,
          xlsxData: xlsxData,
          pdfData: pdfData,
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

worker.on("ready", () => {
  console.log("🟠 [WORKER] Worker is ready and listening for jobs on queue: report-generation");
});

worker.on("active", (job) => {
  console.log(`🟠 [WORKER] Job ${job.id} is now active`);
});

worker.on("error", (error) => {
  console.error("❌ [WORKER] Worker error:", error);
});

worker.on("failed", (job, error) => {
  console.error(`❌ [WORKER] Job ${job?.id} failed:`, error);
});

worker.on("completed", (job) => {
  console.log(`🟠 [WORKER] Job ${job.id} completed successfully`);
});

console.log("Report worker started");

// Graceful shutdown
process.on("SIGTERM", async () => {
  await worker.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

