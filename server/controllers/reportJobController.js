const { PrismaClient } = require("@prisma/client");
const { Queue } = require("bullmq");
const Redis = require("ioredis");
const path = require("path");
const fs = require("fs-extra");

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null, // Required for BullMQ
});

// Initialize BullMQ queue
const reportQueue = new Queue("report-generation", {
  connection: redis,
});

/**
 * Create a new report job
 */
async function create(req, res) {
  console.log(`🟣 [CONTROLLER] create() called for POST /api/report-jobs`);
  console.log(`🟣 [CONTROLLER] req.body:`, JSON.stringify(req.body, null, 2));
  console.log(`🟣 [CONTROLLER] req.shop:`, req.shop ? { id: req.shop.id, shopDomain: req.shop.shopDomain } : "MISSING");
  console.log(`🟣 [CONTROLLER] req.shopifySession:`, req.shopifySession ? { shop: req.shopifySession.shop } : "MISSING");
  
  try {
    const { startDate, endDate, financialStatus, fulfillmentStatus, reportType } = req.body;
    
    console.log(`🟣 [CONTROLLER] Parsed params:`, { startDate, endDate, financialStatus, fulfillmentStatus, reportType });
    
    if (!req.shop || !req.shop.id) {
      console.error(`❌ [CONTROLLER] Missing shop in request!`);
      console.error(`❌ [CONTROLLER] req.shop:`, req.shop);
      return res.status(401).json({ error: "Authentication required", debug: "Controller: req.shop is missing" });
    }
    
    const shopId = req.shop.id;
    console.log(`✅ [CONTROLLER] Shop ID:`, shopId);

    // Validate input
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    // Create report job
    console.log(`🟣 [CONTROLLER] Creating report job in database...`);
    const job = await prisma.reportJob.create({
      data: {
        shopId,
        status: "QUEUED",
        paramsJson: JSON.stringify({
          startDate,
          endDate,
          financialStatus: financialStatus || ["paid", "partially_paid"],
          fulfillmentStatus: fulfillmentStatus || null,
          reportType: reportType || "standard", // "standard" or "qb"
        }),
      },
    });
    console.log(`✅ [CONTROLLER] Report job created:`, { id: job.id, status: job.status });

    // Add job to queue
    console.log(`🟣 [CONTROLLER] Adding job to BullMQ queue...`);
    await reportQueue.add("generate-report", {
      jobId: job.id,
      shopId,
      params: {
        startDate,
        endDate,
        financialStatus: financialStatus || ["paid", "partially_paid"],
        fulfillmentStatus: fulfillmentStatus || null,
        reportType: reportType || "standard",
      },
    });
    console.log(`✅ [CONTROLLER] Job added to queue`);

    console.log(`✅ [CONTROLLER] Sending response with job:`, { id: job.id, status: job.status });
    res.json(job);
  } catch (error) {
    console.error(`❌ [CONTROLLER] Error creating report job:`, error);
    console.error(`❌ [CONTROLLER] Error stack:`, error.stack);
    res.status(500).json({ error: "Failed to create report job", details: error.message });
  }
}

/**
 * List report jobs for the shop
 */
async function list(req, res) {
  console.log(`🟣 [CONTROLLER] list() called for GET /api/report-jobs`);
  console.log(`🟣 [CONTROLLER] req.shop:`, req.shop ? { id: req.shop.id, shopDomain: req.shop.shopDomain } : "MISSING");
  
  try {
    if (!req.shop || !req.shop.id) {
      console.error(`❌ [CONTROLLER] Missing shop in list request!`);
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const shopId = req.shop.id;
    console.log(`🟣 [CONTROLLER] Fetching jobs for shopId:`, shopId);
    
    // Use raw query to check data presence without fetching the data itself
    const jobs = await prisma.$queryRaw`
      SELECT 
        id, 
        shop_id as "shopId", 
        status, 
        params_json as "paramsJson",
        csv_path as "csvPath",
        pdf_path as "pdfPath",
        xlsx_path as "xlsxPath",
        (csv_data IS NOT NULL) as "hasCsvData",
        (xlsx_data IS NOT NULL) as "hasXlsxData",
        (pdf_data IS NOT NULL) as "hasPdfData",
        error_message as "errorMessage",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM report_jobs
      WHERE shop_id = ${shopId}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    console.log(`✅ [CONTROLLER] Found ${jobs.length} jobs`);
    res.json(jobs);
  } catch (error) {
    console.error(`❌ [CONTROLLER] Error listing report jobs:`, error);
    console.error(`❌ [CONTROLLER] Error stack:`, error.stack);
    res.status(500).json({ error: "Failed to list report jobs", details: error.message });
  }
}

/**
 * Get a specific report job
 */
async function get(req, res) {
  try {
    const { id } = req.params;
    const shopId = req.shop.id;

    const job = await prisma.reportJob.findUnique({
      where: { id },
    });

    if (!job) {
      return res.status(404).json({ error: "Report job not found" });
    }

    if (job.shopId !== shopId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json(job);
  } catch (error) {
    console.error("Error getting report job:", error);
    res.status(500).json({ error: "Failed to get report job" });
  }
}

/**
 * Download CSV file
 */
async function downloadCsv(req, res) {
  try {
    const { id } = req.params;
    const shopId = req.shop.id;

    const job = await prisma.reportJob.findUnique({
      where: { id },
    });

    if (!job) {
      return res.status(404).json({ error: "Report job not found" });
    }

    if (job.shopId !== shopId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (job.status !== "COMPLETE" || !job.csvData) {
      return res.status(400).json({ error: "Report not ready or CSV not generated" });
    }

    // Determine filename based on report type
    const params = JSON.parse(job.paramsJson);
    const reportType = params.reportType || "standard";
    let filename = `report-${id}.csv`;
    if (reportType === "qb") {
      filename = `qb-report-${id}.csv`;
    } else if (reportType === "internal_vendors") {
      filename = `internal-vendors-report-${id}.csv`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(job.csvData);
  } catch (error) {
    console.error("Error downloading CSV:", error);
    res.status(500).json({ error: "Failed to download CSV" });
  }
}

/**
 * Download PDF file
 */
async function downloadPdf(req, res) {
  try {
    const { id } = req.params;
    const shopId = req.shop.id;

    const job = await prisma.reportJob.findUnique({
      where: { id },
    });

    if (!job) {
      return res.status(404).json({ error: "Report job not found" });
    }

    if (job.shopId !== shopId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (job.status !== "COMPLETE" || !job.pdfData) {
      return res.status(400).json({ error: "Report not ready or PDF not generated" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="report-${id}.pdf"`);
    res.send(job.pdfData);
  } catch (error) {
    console.error("Error downloading PDF:", error);
    res.status(500).json({ error: "Failed to download PDF" });
  }
}

/**
 * Download XLSX file
 */
async function downloadXlsx(req, res) {
  try {
    const { id } = req.params;
    const shopId = req.shop.id;

    const job = await prisma.reportJob.findUnique({
      where: { id },
    });

    if (!job) {
      return res.status(404).json({ error: "Report job not found" });
    }

    if (job.shopId !== shopId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (job.status !== "COMPLETE" || !job.xlsxData) {
      return res.status(400).json({ error: "Report not ready or XLSX not generated" });
    }

    // Determine filename based on report type
    const params = JSON.parse(job.paramsJson);
    const reportType = params.reportType || "standard";
    let filename = `report-${id}.xlsx`;
    if (reportType === "qb") {
      filename = `qb-report-${id}.xlsx`;
    } else if (reportType === "internal_vendors") {
      filename = `internal-vendors-report-${id}.xlsx`;
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(job.xlsxData);
  } catch (error) {
    console.error("Error downloading XLSX:", error);
    res.status(500).json({ error: "Failed to download XLSX" });
  }
}

module.exports = {
  create,
  list,
  get,
  downloadCsv,
  downloadPdf,
  downloadXlsx,
};

