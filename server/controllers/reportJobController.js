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
    const { startDate, endDate, financialStatus, fulfillmentStatus } = req.body;
    
    console.log(`🟣 [CONTROLLER] Parsed params:`, { startDate, endDate, financialStatus, fulfillmentStatus });
    
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
    
    const jobs = await prisma.reportJob.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

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

    if (job.status !== "COMPLETE" || !job.csvPath) {
      return res.status(400).json({ error: "Report not ready or CSV not generated" });
    }

    const filePath = path.join(__dirname, "../../", job.csvPath);
    
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: "CSV file not found" });
    }

    res.download(filePath, `report-${id}.csv`, (err) => {
      if (err) {
        console.error("Error downloading CSV:", err);
        res.status(500).json({ error: "Failed to download CSV" });
      }
    });
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

    if (job.status !== "COMPLETE" || !job.pdfPath) {
      return res.status(400).json({ error: "Report not ready or PDF not generated" });
    }

    const filePath = path.join(__dirname, "../../", job.pdfPath);
    
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: "PDF file not found" });
    }

    res.download(filePath, `report-${id}.pdf`, (err) => {
      if (err) {
        console.error("Error downloading PDF:", err);
        res.status(500).json({ error: "Failed to download PDF" });
      }
    });
  } catch (error) {
    console.error("Error downloading PDF:", error);
    res.status(500).json({ error: "Failed to download PDF" });
  }
}

module.exports = {
  create,
  list,
  get,
  downloadCsv,
  downloadPdf,
};

