#!/usr/bin/env node

/**
 * Setup script to configure .env file with local defaults
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const envPath = path.join(__dirname, "../.env");
const templatePath = path.join(__dirname, "../ENV_TEMPLATE.txt");

// Generate random session secret
const sessionSecret = crypto.randomBytes(32).toString("hex");

// Get current user for database URL
const user = process.env.USER || "postgres";

// Read template
let envContent = fs.readFileSync(templatePath, "utf8");

// Replace placeholders with local defaults
envContent = envContent.replace(
  "DATABASE_URL=postgresql://user:password@localhost:5432/shopify_reports?schema=public",
  `DATABASE_URL=postgresql://${user}@localhost:5432/shopify_reports?schema=public`
);

envContent = envContent.replace(
  "SESSION_SECRET=your_random_session_secret_here",
  `SESSION_SECRET=${sessionSecret}`
);

// Write .env file
fs.writeFileSync(envPath, envContent);

console.log("✅ .env file created!");
console.log("\n⚠️  IMPORTANT: You still need to add:");
console.log("   - SHOPIFY_API_KEY (from Partner Dashboard)");
console.log("   - SHOPIFY_API_SECRET (from Partner Dashboard)");
console.log("   - SHOPIFY_APP_URL (your ngrok URL after starting ngrok)");
console.log("\n📝 Edit .env file to add these values.");




