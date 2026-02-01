const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Middleware to authenticate Shopify session and ensure shop is registered
 */
async function authenticate(req, res, next) {
  console.log(`🟡 [AUTH] authenticate middleware called for ${req.method} ${req.path}`);
  
  try {
    // validateAuthenticatedSession sets res.locals.shopify.session
    const session = res.locals.shopify?.session;
    
    console.log(`🟡 [AUTH] Checking session:`, {
      hasResLocalsShopify: !!res.locals.shopify,
      hasSession: !!session,
      sessionShop: session?.shop,
      sessionId: session?.id,
      resLocalsKeys: Object.keys(res.locals),
      reqPath: req.path
    });
    
    if (!session) {
      console.error(`❌ [AUTH] No session found!`);
      console.error(`❌ [AUTH] res.locals keys:`, Object.keys(res.locals));
      console.error(`❌ [AUTH] res.locals.shopify:`, res.locals.shopify);
      console.error(`❌ [AUTH] res.locals:`, JSON.stringify(res.locals, null, 2));
      return res.status(401).json({ error: "Unauthorized: No Shopify session", debug: "authenticate middleware: no session in res.locals.shopify.session" });
    }
    
    console.log(`✅ [AUTH] Session found:`, session.shop);

    const shopDomain = session.shop;
    
    // Ensure shop exists in database
    let shop = await prisma.shop.findUnique({
      where: { shopDomain },
    });

    if (!shop) {
      // Create shop record if it doesn't exist
      shop = await prisma.shop.create({
        data: {
          shopDomain,
          accessToken: session.accessToken,
        },
      });
    } else {
      // Update access token if it changed
      if (shop.accessToken !== session.accessToken) {
        shop = await prisma.shop.update({
          where: { shopDomain },
          data: { accessToken: session.accessToken },
        });
      }
    }

    // Attach shop to request
    req.shop = shop;
    req.shopifySession = session;
    
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}

/**
 * Middleware to ensure user owns the report job
 */
async function ensureJobOwnership(req, res, next) {
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
      return res.status(403).json({ error: "Forbidden: Job does not belong to this shop" });
    }

    req.reportJob = job;
    next();
  } catch (error) {
    console.error("Job ownership check error:", error);
    res.status(500).json({ error: "Failed to verify job ownership" });
  }
}

module.exports = {
  authenticate,
  ensureJobOwnership,
};

