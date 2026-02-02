// Import adapter FIRST before any shopify-api usage
require("@shopify/shopify-api/adapters/node");

require("dotenv").config();
const express = require("express");
const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
const { shopifyApp } = require("@shopify/shopify-app-express");
const { PrismaClient } = require("@prisma/client");
const { PrismaSessionStorage } = require("@shopify/shopify-app-session-storage-prisma");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const prisma = new PrismaClient();
const sessionStorage = new PrismaSessionStorage(prisma);

// Parse hostname from URL
const getHostName = () => {
  const url = process.env.SHOPIFY_APP_URL || "http://localhost:3000";
  try {
    const urlObj = new URL(url);
    return urlObj.host;
  } catch (e) {
    const cleaned = url.replace(/^https?:\/\//, "").split("/")[0].split("?")[0];
    return cleaned || "localhost:3000";
  }
};

const hostName = getHostName();

console.log(`🚀 [STARTUP] Host: ${hostName}`);
console.log(`🚀 [STARTUP] API Key: ${process.env.SHOPIFY_API_KEY ? 'SET' : 'MISSING'}`);
console.log(`🚀 [STARTUP] App URL: ${process.env.SHOPIFY_APP_URL}`);

// Initialize Shopify App middleware
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

// Basic middleware
expressApp.use(cors({ origin: true, credentials: true }));
expressApp.use(require("cookie-parser")());
expressApp.use(express.urlencoded({ extended: true }));
expressApp.use(express.json());

// Request logging
expressApp.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
expressApp.get("/health", (req, res) => res.json({ status: "ok" }));

// Mount ALL Shopify routes using the middleware's built-in handlers
// This handles /auth, /auth/callback, and the bounce page for embedded apps
expressApp.get("/auth", shopifyAppMiddleware.auth.begin());
expressApp.get("/auth/callback", shopifyAppMiddleware.auth.callback());
expressApp.post("/auth/callback", shopifyAppMiddleware.auth.callback());

// Serve static assets
expressApp.use("/assets", express.static(path.join(__dirname, "../client/dist/assets")));
expressApp.use("/favicon.ico", express.static(path.join(__dirname, "../client/dist/favicon.ico")));

// API routes with session lookup from database
expressApp.use("/api", async (req, res, next) => {
  try {
    const shopDomain = req.query.shop || 'shopinbtweenproduction.myshopify.com';
    
    console.log(`🟢 [API] ${req.method} ${req.path} - shop: ${shopDomain}`);
    
    const dbSession = await prisma.session.findFirst({
      where: { shop: { equals: shopDomain, mode: 'insensitive' } }
    });
    
    if (!dbSession) {
      console.error(`❌ [API] No session for shop: ${shopDomain}`);
      return res.status(401).json({ error: "Session not found. Please reinstall the app." });
    }
    
    res.locals.shopify = {
      session: {
        id: dbSession.id,
        shop: dbSession.shop,
        accessToken: dbSession.accessToken,
        scope: dbSession.scope || '',
        isOnline: dbSession.isOnline,
      }
    };
    
    console.log(`✅ [API] Session found for: ${dbSession.shop}`);
    next();
  } catch (error) {
    console.error(`❌ [API] Error:`, error);
    res.status(500).json({ error: "Authentication error" });
  }
});
expressApp.use("/api", require("./routes/api"));

// Use Shopify's built-in redirect middleware for embedded app handling
// This handles the cookie/bounce page logic for OAuth in iframes
expressApp.use(shopifyAppMiddleware.redirectToShopifyOrAppRoot);

// Serve the React app for all other routes
// validateAuthenticatedSession ensures the user is authenticated
expressApp.get("*", shopifyAppMiddleware.validateAuthenticatedSession, (req, res) => {
  const indexPath = path.join(__dirname, "../client/dist/index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("React app not built. Run: cd client && npm run build");
  }
});

const PORT = process.env.PORT || 3000;
expressApp.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
