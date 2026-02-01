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
  scopes: process.env.SCOPES?.split(",") || ["read_orders", "read_products"],
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
    scopes: process.env.SCOPES?.split(",") || ["read_orders", "read_products"],
    hostName: hostName,
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
  },
  sessionStorage: sessionStorage,
  auth: {
    path: "/auth",
    callbackPath: "/auth/callback",
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
expressApp.get("/auth", shopifyAppMiddleware.auth.begin());
expressApp.get("/auth/callback", shopifyAppMiddleware.auth.callback());
expressApp.post("/auth/callback", shopifyAppMiddleware.auth.callback()); // Some OAuth flows use POST

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
    
    // Get session from database by shop domain
    const dbSession = await prisma.session.findUnique({
      where: { shop: shopDomain },
    });
    
    console.log(`🟢 [SERVER] Session from DB:`, dbSession ? { shop: dbSession.shop, id: dbSession.id.substring(0, 20) } : 'no session');
    
    if (!dbSession) {
      console.error(`❌ [SERVER] Session not found in database for shop:`, shopDomain);
      return res.status(401).json({ error: "Unauthorized: Session not found. Please reinstall the app." });
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

