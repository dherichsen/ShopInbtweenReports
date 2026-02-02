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

// Initialize Shopify App with proper embedded app configuration
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
  // Exit iframe for OAuth - this handles the cookie issue in embedded apps
  exitIframePath: "/exitiframe",
  useOnlineTokens: false,
});

const app = express();

app.use(express.json());

// Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Exit iframe route - handles OAuth redirect outside of iframe
app.get("/exitiframe", (req, res) => {
  const { shop, host } = req.query;
  const redirectUri = `${process.env.SHOPIFY_APP_URL}/auth?shop=${shop}`;
  
  // Render a page that breaks out of the iframe
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
        <script>
          const host = "${host}";
          const redirectUri = "${redirectUri}";
          
          if (window.top !== window.self) {
            // We're in an iframe, use App Bridge to redirect
            const AppBridge = window['app-bridge'];
            const createApp = AppBridge.default;
            const Redirect = AppBridge.actions.Redirect;
            
            const app = createApp({
              apiKey: "${process.env.SHOPIFY_API_KEY}",
              host: host,
            });
            
            const redirect = Redirect.create(app);
            redirect.dispatch(Redirect.Action.REMOTE, redirectUri);
          } else {
            // Not in iframe, redirect normally
            window.location.href = redirectUri;
          }
        </script>
      </head>
      <body>Redirecting...</body>
    </html>
  `);
});

// Mount Shopify auth routes
app.get("/auth", shopify.auth.begin());
app.get("/auth/callback", shopify.auth.callback());
app.post("/auth/callback", shopify.auth.callback());

// Static assets
app.use("/assets", express.static(path.join(__dirname, "../client/dist/assets")));

// API routes - use Shopify's session validation
app.use("/api", shopify.validateAuthenticatedSession);
app.use("/api", require("./routes/api"));

// For all other routes, use Shopify's redirect middleware
// This handles session validation and redirects to OAuth if needed
app.use(shopify.ensureInstalledOnShop);

// Serve the React app
app.get("*", (req, res) => {
  const indexPath = path.join(__dirname, "../client/dist/index.html");
  if (fs.existsSync(indexPath)) {
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
