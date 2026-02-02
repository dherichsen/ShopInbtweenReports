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

if (!hostName) {
  console.error("ERROR: hostName is not set. Check SHOPIFY_APP_URL in .env");
  process.exit(1);
}

// Initialize Shopify API
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES?.split(",") || ["read_orders", "read_products", "read_customers"],
  hostName: hostName,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
});

// Initialize Shopify App
// shopifyApp expects API config in 'api' key, or will create its own from top-level config
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
    // This prevents the 415 error during OAuth
  },
});

const expressApp = express();
const cookieParser = require("cookie-parser");

// Middleware - IMPORTANT: urlencoded must come before json for OAuth callbacks
expressApp.use(cors({
  origin: true,
  credentials: true, // Allow cookies
}));
expressApp.use(cookieParser()); // Parse cookies for session
expressApp.use(express.urlencoded({ extended: true })); // Needed for OAuth callbacks
expressApp.use(express.json());

// Request logging middleware
expressApp.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, req.body ? JSON.stringify(req.body).substring(0, 100) : '');
  next();
});

// Mount Shopify OAuth routes
// Note: auth.begin and auth.callback are functions that return middleware
expressApp.get("/auth", (req, res, next) => {
  console.log(`🔵 [OAUTH] GET /auth - Starting OAuth flow`);
  console.log(`🔵 [OAUTH] Query params:`, req.query);
  shopifyAppMiddleware.auth.begin()(req, res, next);
});

expressApp.get("/auth/callback", (req, res, next) => {
  console.log(`🔵 [OAUTH] GET /auth/callback - OAuth callback received`);
  console.log(`🔵 [OAUTH] Query params:`, req.query);
  console.log(`🔵 [OAUTH] Cookies:`, req.cookies);
  
  const callbackMiddleware = shopifyAppMiddleware.auth.callback();
  callbackMiddleware(req, res, (err) => {
    if (err) {
      console.error(`❌ [OAUTH] Callback error:`, err);
      return next(err);
    }
    
    // Check if session was created after a short delay
    setTimeout(async () => {
      try {
        const allSessions = await prisma.session.findMany();
        console.log(`🔵 [OAUTH] Sessions after callback:`, allSessions.map(s => ({ shop: s.shop, id: s.id.substring(0, 20) })));
      } catch (e) {
        console.error(`❌ [OAUTH] Error checking sessions:`, e);
      }
    }, 1000);
    
    if (!res.headersSent) {
      next();
    }
  });
});

expressApp.post("/auth/callback", (req, res, next) => {
  console.log(`🔵 [OAUTH] POST /auth/callback - OAuth callback received`);
  console.log(`🔵 [OAUTH] Body:`, req.body);
  console.log(`🔵 [OAUTH] Cookies:`, req.cookies);
  
  const callbackMiddleware = shopifyAppMiddleware.auth.callback();
  callbackMiddleware(req, res, (err) => {
    if (err) {
      console.error(`❌ [OAUTH] Callback error:`, err);
      return next(err);
    }
    
    // Check if session was created after a short delay
    setTimeout(async () => {
      try {
        const allSessions = await prisma.session.findMany();
        console.log(`🔵 [OAUTH] Sessions after callback:`, allSessions.map(s => ({ shop: s.shop, id: s.id.substring(0, 20) })));
      } catch (e) {
        console.error(`❌ [OAUTH] Error checking sessions:`, e);
      }
    }, 1000);
    
    if (!res.headersSent) {
      next();
    }
  });
});

// API Routes - Manually handle session to avoid hanging
expressApp.use("/api", async (req, res, next) => {
  console.log(`🟢 [SERVER] ${req.method} ${req.path} - Request received`);
  console.log(`🟢 [SERVER] Cookies:`, req.cookies);
  console.log(`🟢 [SERVER] Headers:`, {
    cookie: req.headers.cookie ? 'present' : 'missing',
    'x-shopify-shop-domain': req.headers['x-shopify-shop-domain'],
  });
  
  try {
    // Get shop domain from various sources
    const shopDomain = req.query.shop || 
                      req.headers['x-shopify-shop-domain'] ||
                      req.headers['shopify-shop-domain'] ||
                      'shopinbtweenproduction.myshopify.com'; // Fallback to known shop
    
    console.log(`🟢 [SERVER] Shop domain:`, shopDomain);
    console.log(`🟢 [SERVER] All headers with 'shop':`, Object.keys(req.headers).filter(k => k.toLowerCase().includes('shop')));
    
    // Debug: List all sessions in database
    const allSessions = await prisma.session.findMany({
      select: { shop: true, id: true, createdAt: true }
    });
    console.log(`🟢 [SERVER] All sessions in DB:`, allSessions);
    console.log(`🟢 [SERVER] Looking for shop:`, shopDomain);
    
    // Try exact match first
    let dbSession = await prisma.session.findUnique({
      where: { shop: shopDomain },
    });
    
    // If not found, try case-insensitive search
    if (!dbSession) {
      console.log(`🟡 [SERVER] Exact match not found, trying case-insensitive search...`);
      dbSession = await prisma.session.findFirst({
        where: {
          shop: {
            equals: shopDomain,
            mode: 'insensitive'
          }
        }
      });
    }
    
    // If still not found, try without .myshopify.com
    if (!dbSession && shopDomain.includes('.myshopify.com')) {
      const shopWithoutDomain = shopDomain.replace('.myshopify.com', '');
      console.log(`🟡 [SERVER] Trying without .myshopify.com:`, shopWithoutDomain);
      dbSession = await prisma.session.findFirst({
        where: {
          shop: {
            contains: shopWithoutDomain
          }
        }
      });
    }
    
    console.log(`🟢 [SERVER] Session from DB:`, dbSession ? { shop: dbSession.shop, id: dbSession.id.substring(0, 20) } : 'no session');
    
    if (!dbSession) {
      console.error(`❌ [SERVER] Session not found in database for shop:`, shopDomain);
      console.error(`❌ [SERVER] Available shops in DB:`, allSessions.map(s => s.shop));
      return res.status(401).json({ error: "Unauthorized: Session not found. Please reinstall the app.", debug: { requestedShop: shopDomain, availableShops: allSessions.map(s => s.shop) } });
    }
    
    // Convert DB session to Shopify session format
    const session = {
      id: dbSession.id,
      shop: dbSession.shop,
      state: dbSession.state,
      isOnline: dbSession.isOnline,
      scope: dbSession.scope || '',
      expires: dbSession.expires,
      accessToken: dbSession.accessToken,
      userId: dbSession.userId,
    };
    
    // Set session in res.locals for our auth middleware
    if (!res.locals.shopify) {
      res.locals.shopify = {};
    }
    res.locals.shopify.session = session;
    
    console.log(`✅ [SERVER] Session found:`, session.shop);
    next();
  } catch (error) {
    console.error(`❌ [SERVER] Error getting session:`, error);
    console.error(`❌ [SERVER] Error stack:`, error.stack);
    res.status(500).json({ error: "Authentication error", details: error.message });
  }
});
expressApp.use("/api", require("./routes/api"));

// Health check endpoint (no auth required)
expressApp.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Serve static files from React app (before auth for assets)
expressApp.use(express.static(path.join(__dirname, "../client/dist")));

// Use shopifyApp's redirect middleware BEFORE validateAuthenticatedSession
// This handles unauthenticated requests and redirects them properly
expressApp.use(shopifyAppMiddleware.redirectToShopifyOrAppRoot);

// Catch all handler: send back React's index.html file for SPA routing (protected)
// This only runs if redirectToShopifyOrAppRoot didn't redirect
expressApp.get("*", shopifyAppMiddleware.validateAuthenticatedSession, (req, res) => {
  const indexPath = path.join(__dirname, "../client/dist/index.html");
  if (require("fs").existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("React app not built. Run: cd client && npm run build");
  }
});

const PORT = process.env.PORT || 3000;

expressApp.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Hostname: ${hostName}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

