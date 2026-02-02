const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { authenticate } = require("../middleware/auth");
const reportJobController = require("../controllers/reportJobController");

const prisma = new PrismaClient();

// Report job routes
router.post("/report-jobs", authenticate, reportJobController.create);
router.get("/report-jobs", authenticate, reportJobController.list);
router.get("/report-jobs/:id", authenticate, reportJobController.get);
router.get("/report-jobs/:id/download.csv", authenticate, reportJobController.downloadCsv);
router.get("/report-jobs/:id/download.pdf", authenticate, reportJobController.downloadPdf);
router.get("/report-jobs/:id/download.xlsx", authenticate, reportJobController.downloadXlsx);

module.exports = router;

