// Import adapter FIRST before any shopify-api usage
require("@shopify/shopify-api/adapters/node");

require("dotenv").config();
const express = require("express");
const { LATEST_API_VERSION } = require("@shopify/shopify-api");
const { shopifyApp } = require("@shopify/shopify-app-express");
const { PrismaClient } = require("@prisma/client");
const { PrismaSessionStorage } = require("@shopify/shopify-app-session-storage-prisma");
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
console.log(`🚀 Host: ${hostName}`);

const shopify = shopifyApp({
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

const app = express();
app.use(express.json());

// Allow embedding in Shopify iframe
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "frame-ancestors https://*.myshopify.com https://admin.shopify.com");
  next();
});

// Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} shop=${req.query.shop || 'none'}`);
  next();
});

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Reset endpoint - clears session to force reinstall
app.get("/reset", async (req, res) => {
  const shop = req.query.shop;
  if (!shop) {
    return res.status(400).json({ error: "shop param required" });
  }
  
  try {
    await prisma.session.deleteMany({ where: { shop: { contains: shop, mode: 'insensitive' } } });
    await prisma.shop.deleteMany({ where: { shopDomain: { contains: shop, mode: 'insensitive' } } });
    res.json({ success: true, message: `Cleared sessions for ${shop}. Now click the install link again.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OAuth routes
app.get("/auth", shopify.auth.begin());

// Custom callback that skips webhook registration
app.get("/auth/callback", async (req, res, next) => {
  try {
    const callback = shopify.auth.callback();
    await callback(req, res, (err) => {
      if (err) {
        // Log but ignore webhook registration errors
        if (err.message && err.message.includes('415')) {
          console.log('Ignoring webhook registration error');
          // Redirect to app after successful auth
          const shop = req.query.shop;
          return res.redirect(`/?shop=${encodeURIComponent(shop)}&host=${req.query.host || ''}`);
        }
        return next(err);
      }
    });
  } catch (err) {
    if (err.message && err.message.includes('415')) {
      console.log('Ignoring webhook registration error');
      const shop = req.query.shop;
      return res.redirect(`/?shop=${encodeURIComponent(shop)}&host=${req.query.host || ''}`);
    }
    next(err);
  }
});

app.post("/auth/callback", async (req, res, next) => {
  try {
    const callback = shopify.auth.callback();
    await callback(req, res, (err) => {
      if (err) {
        if (err.message && err.message.includes('415')) {
          console.log('Ignoring webhook registration error');
          const shop = req.query.shop || req.body?.shop;
          return res.redirect(`/?shop=${encodeURIComponent(shop)}&host=${req.query.host || ''}`);
        }
        return next(err);
      }
    });
  } catch (err) {
    if (err.message && err.message.includes('415')) {
      console.log('Ignoring webhook registration error');
      const shop = req.query.shop || req.body?.shop;
      return res.redirect(`/?shop=${encodeURIComponent(shop)}&host=${req.query.host || ''}`);
    }
    next(err);
  }
});

// Static assets
app.use("/assets", express.static(path.join(__dirname, "../client/dist/assets")));

// API routes
app.use("/api", async (req, res, next) => {
  const shop = req.query.shop || 'shopinbtweenproduction.myshopify.com';
  const session = await prisma.session.findFirst({
    where: { shop: { equals: shop, mode: 'insensitive' } }
  });
  
  if (!session) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  
  res.locals.shopify = { session };
  next();
});
app.use("/api", require("./routes/api"));

// App routes - check for session, redirect to auth if missing
app.get("*", async (req, res) => {
  const shop = req.query.shop;
  
  console.log(`🌐 App request: shop=${shop}`);
  
  if (shop) {
    const session = await prisma.session.findFirst({
      where: { shop: { equals: shop, mode: 'insensitive' } }
    });
    
    console.log(`🔍 Session check: ${session ? 'found' : 'not found'}`);
    
    if (!session) {
      console.log(`🔄 Redirecting to /auth`);
      return res.redirect(`/auth?shop=${encodeURIComponent(shop)}`);
    }
  }
  
  const indexPath = path.join(__dirname, "../client/dist/index.html");
  if (fs.existsSync(indexPath)) {
    console.log(`✅ Serving React app`);
    res.sendFile(indexPath);
  } else {
    res.status(404).send("React app not built");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
