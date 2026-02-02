// Import adapter FIRST before any shopify-api usage
require("@shopify/shopify-api/adapters/node");

require("dotenv").config();
const express = require("express");
const { LATEST_API_VERSION } = require("@shopify/shopify-api");
const { shopifyApp } = require("@shopify/shopify-app-express");
const { PrismaClient } = require("@prisma/client");
const { PrismaSessionStorage } = require("@shopify/shopify-app-session-storage-prisma");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const prisma = new PrismaClient();
const sessionStorage = new PrismaSessionStorage(prisma);

const getHostName = () => {
  const url = process.env.SHOPIFY_APP_URL || "http://localhost:3000";
  try {
    return new URL(url).host;
  } catch (e) {
    return url.replace(/^https?:\/\//, "").split("/")[0] || "localhost:3000";
  }
};

const hostName = getHostName();
console.log(`🚀 [STARTUP] Host: ${hostName}, App URL: ${process.env.SHOPIFY_APP_URL}`);

const shopifyAppMiddleware = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: process.env.SCOPES?.split(",") || ["read_orders", "read_products", "read_customers"],
    hostName: hostName,
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
  },
  sessionStorage: sessionStorage,
  auth: {
    path: "/auth",
    callbackPath: "/auth/callback",
  },
  useOnlineTokens: false,
});

const expressApp = express();

expressApp.use(cors({ origin: true, credentials: true }));
expressApp.use(require("cookie-parser")());
expressApp.use(express.urlencoded({ extended: true }));
expressApp.use(express.json());

expressApp.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}${req.query.shop ? ` shop=${req.query.shop}` : ''}`);
  next();
});

expressApp.get("/health", (req, res) => res.json({ status: "ok" }));

// OAuth routes - mounted first
expressApp.get("/auth", shopifyAppMiddleware.auth.begin());
expressApp.get("/auth/callback", shopifyAppMiddleware.auth.callback());
expressApp.post("/auth/callback", shopifyAppMiddleware.auth.callback());

// Static assets only
expressApp.use("/assets", express.static(path.join(__dirname, "../client/dist/assets")));

// API routes
expressApp.use("/api", async (req, res, next) => {
  const shopDomain = req.query.shop || 'shopinbtweenproduction.myshopify.com';
  console.log(`🟢 [API] ${req.method} ${req.path} - shop: ${shopDomain}`);
  
  const dbSession = await prisma.session.findFirst({
    where: { shop: { equals: shopDomain, mode: 'insensitive' } }
  });
  
  if (!dbSession) {
    return res.status(401).json({ error: "Session not found. Please reinstall the app." });
  }
  
  res.locals.shopify = {
    session: { id: dbSession.id, shop: dbSession.shop, accessToken: dbSession.accessToken }
  };
  next();
});
expressApp.use("/api", require("./routes/api"));

// Root and app routes - check for Shopify params and redirect to auth if needed
expressApp.get("*", async (req, res, next) => {
  const shop = req.query.shop;
  const host = req.query.host;
  
  // If this is a Shopify request (has shop param), check for session
  if (shop) {
    console.log(`🔍 [APP] Checking session for shop: ${shop}`);
    
    const session = await prisma.session.findFirst({
      where: { shop: { equals: shop, mode: 'insensitive' } }
    });
    
    if (!session) {
      // No session - need to authenticate
      console.log(`🔄 [APP] No session - redirecting to /auth`);
      return res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
    }
    
    console.log(`✅ [APP] Session exists for ${shop}`);
  }
  
  // Serve the React app
  const indexPath = path.join(__dirname, "../client/dist/index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("React app not built");
  }
});

const PORT = process.env.PORT || 3000;
expressApp.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
