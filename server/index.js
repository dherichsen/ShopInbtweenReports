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
  if (!url) {
    return "localhost:3000";
  }
  try {
    const urlObj = new URL(url);
    return urlObj.host;
  } catch (e) {
    // Fallback: remove protocol and path
    const cleaned = url.replace(/^https?:\/\//, "").split("/")[0].split("?")[0];
    return cleaned || "localhost:3000";
  }
};

const hostName = getHostName();

console.log(`🚀 [STARTUP] Initializing Shopify app...`);
console.log(`🚀 [STARTUP] Host: ${hostName}`);
console.log(`🚀 [STARTUP] API Key: ${process.env.SHOPIFY_API_KEY ? 'SET' : 'MISSING'}`);
console.log(`🚀 [STARTUP] API Secret: ${process.env.SHOPIFY_API_SECRET ? 'SET' : 'MISSING'}`);
console.log(`🚀 [STARTUP] App URL: ${process.env.SHOPIFY_APP_URL}`);
console.log(`🚀 [STARTUP] Scopes: ${process.env.SCOPES}`);

if (!hostName) {
  console.error("ERROR: hostName is not set. Check SHOPIFY_APP_URL in .env");
  process.exit(1);
}

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
  webhooks: {
    // Disable automatic webhook registration since we don't use webhooks
  },
});

const expressApp = express();
const cookieParser = require("cookie-parser");

// Basic middleware
expressApp.use(cors({
  origin: true,
  credentials: true,
}));
expressApp.use(cookieParser());
expressApp.use(express.urlencoded({ extended: true }));
expressApp.use(express.json());

// Request logging
expressApp.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check (no auth)
expressApp.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// OAuth routes - these MUST come before any auth checks
expressApp.get("/auth", async (req, res, next) => {
  console.log(`🔵 [OAUTH] GET /auth - Starting OAuth flow`);
  console.log(`🔵 [OAUTH] Query params:`, req.query);
  console.log(`🔵 [OAUTH] Shop:`, req.query.shop);
  try {
    await shopifyAppMiddleware.auth.begin()(req, res, next);
  } catch (err) {
    console.error(`❌ [OAUTH] Error in auth.begin:`, err);
    next(err);
  }
});

expressApp.get("/auth/callback", async (req, res, next) => {
  console.log(`🔵 [OAUTH] GET /auth/callback - OAuth callback received`);
  console.log(`🔵 [OAUTH] Query params:`, req.query);
  
  try {
    const callbackMiddleware = shopifyAppMiddleware.auth.callback();
    await callbackMiddleware(req, res, async (err) => {
      if (err) {
        console.error(`❌ [OAUTH] Callback error:`, err);
        return next(err);
      }
      
      console.log(`✅ [OAUTH] Callback completed successfully`);
      
      // Log sessions after callback
      try {
        const allSessions = await prisma.session.findMany();
        console.log(`🔵 [OAUTH] Sessions in DB after callback: ${allSessions.length}`);
        allSessions.forEach(s => {
          console.log(`🔵 [OAUTH] Session: id=${s.id}, shop=${s.shop}, hasToken=${!!s.accessToken}`);
        });
      } catch (e) {
        console.error(`❌ [OAUTH] Error checking sessions:`, e);
      }
    });
  } catch (err) {
    console.error(`❌ [OAUTH] Error in auth.callback:`, err);
    next(err);
  }
});

expressApp.post("/auth/callback", async (req, res, next) => {
  console.log(`🔵 [OAUTH] POST /auth/callback - OAuth callback received`);
  console.log(`🔵 [OAUTH] Body:`, req.body);
  
  try {
    const callbackMiddleware = shopifyAppMiddleware.auth.callback();
    await callbackMiddleware(req, res, async (err) => {
      if (err) {
        console.error(`❌ [OAUTH] POST Callback error:`, err);
        return next(err);
      }
      
      console.log(`✅ [OAUTH] POST Callback completed successfully`);
      
      // Log sessions after callback
      try {
        const allSessions = await prisma.session.findMany();
        console.log(`🔵 [OAUTH] Sessions in DB after POST callback: ${allSessions.length}`);
        allSessions.forEach(s => {
          console.log(`🔵 [OAUTH] Session: id=${s.id}, shop=${s.shop}, hasToken=${!!s.accessToken}`);
        });
      } catch (e) {
        console.error(`❌ [OAUTH] Error checking sessions:`, e);
      }
    });
  } catch (err) {
    console.error(`❌ [OAUTH] Error in POST auth.callback:`, err);
    next(err);
  }
});

// Serve static assets ONLY (not index.html) - CSS, JS, images
expressApp.use("/assets", express.static(path.join(__dirname, "../client/dist/assets")));
expressApp.use("/favicon.ico", express.static(path.join(__dirname, "../client/dist/favicon.ico")));

// API routes with session lookup
expressApp.use("/api", async (req, res, next) => {
  try {
    const shopDomain = req.query.shop || 
                      req.headers['x-shopify-shop-domain'] ||
                      'shopinbtweenproduction.myshopify.com';
    
    console.log(`🟢 [API] ${req.method} ${req.path} - shop: ${shopDomain}`);
    
    const dbSession = await prisma.session.findFirst({
      where: {
        shop: {
          equals: shopDomain,
          mode: 'insensitive'
        }
      }
    });
    
    if (!dbSession) {
      const allSessions = await prisma.session.findMany({ select: { shop: true } });
      console.error(`❌ [API] No session for shop: ${shopDomain}`);
      console.error(`❌ [API] Available shops:`, allSessions.map(s => s.shop));
      return res.status(401).json({ 
        error: "Session not found. Please reinstall the app.",
        availableShops: allSessions.map(s => s.shop)
      });
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

// For the root path and all other paths:
// 1. Check if it's a Shopify embedded request (has shop/host params)
// 2. If so, validate session or redirect to auth
// 3. If valid, serve the app

expressApp.get("*", async (req, res, next) => {
  const shop = req.query.shop;
  const host = req.query.host;
  
  console.log(`🌐 [APP] GET ${req.path} - shop=${shop}, host=${host ? 'present' : 'missing'}`);
  
  // If this is a Shopify embedded request (has shop or host param)
  if (shop || host) {
    // Check if we have a session for this shop
    let shopDomain = shop;
    if (!shopDomain && host) {
      // Decode host to get shop
      try {
        shopDomain = Buffer.from(host, 'base64').toString().split('/')[0];
      } catch (e) {
        console.log(`🟡 [APP] Could not decode host param`);
      }
    }
    
    if (shopDomain) {
      console.log(`🔍 [APP] Looking for session for shop: ${shopDomain}`);
      
      const session = await prisma.session.findFirst({
        where: {
          shop: {
            equals: shopDomain,
            mode: 'insensitive'
          }
        }
      });
      
      if (!session) {
        // No session - redirect to auth
        console.log(`🔄 [APP] No session found - redirecting to /auth`);
        const authUrl = `/auth?shop=${encodeURIComponent(shopDomain)}`;
        return res.redirect(authUrl);
      }
      
      console.log(`✅ [APP] Session found for ${shopDomain} - serving app`);
    }
  }
  
  // Serve the React app
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
  console.log(`🚀 Hostname: ${hostName}`);
  console.log(`🚀 App URL: ${process.env.SHOPIFY_APP_URL}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
