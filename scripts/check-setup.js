#!/usr/bin/env node

/**
 * Quick setup verification script
 * Run with: node scripts/check-setup.js
 */

const { PrismaClient } = require("@prisma/client");
const Redis = require("ioredis");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const checks = [];
let allPassed = true;

function check(name, test) {
  try {
    const result = test();
    checks.push({ name, passed: result, error: null });
    if (!result) allPassed = false;
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
    allPassed = false;
  }
}

console.log("🔍 Checking setup...\n");

// Check environment file
check("Environment file exists", () => {
  return fs.existsSync(path.join(__dirname, "../.env"));
});

// Check required environment variables
check("SHOPIFY_API_KEY is set", () => {
  return !!process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_KEY !== "your_api_key_here";
});

check("SHOPIFY_API_SECRET is set", () => {
  return !!process.env.SHOPIFY_API_SECRET && process.env.SHOPIFY_API_SECRET !== "your_api_secret_here";
});

check("SHOPIFY_APP_URL is set", () => {
  return !!process.env.SHOPIFY_APP_URL && process.env.SHOPIFY_APP_URL !== "https://your-app-url.ngrok.io";
});

check("DATABASE_URL is set", () => {
  return !!process.env.DATABASE_URL;
});

check("REDIS_URL is set", () => {
  return !!process.env.REDIS_URL;
});

// Check database connection
check("Database connection", async () => {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    await prisma.$disconnect();
    return true;
  } catch (error) {
    return false;
  }
});

// Check Redis connection
check("Redis connection", async () => {
  try {
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    await redis.ping();
    await redis.quit();
    return true;
  } catch (error) {
    return false;
  }
});

// Check Prisma client generated
check("Prisma client generated", () => {
  return fs.existsSync(path.join(__dirname, "../node_modules/.prisma/client"));
});

// Check node_modules
check("Dependencies installed (root)", () => {
  return fs.existsSync(path.join(__dirname, "../node_modules"));
});

check("Dependencies installed (client)", () => {
  return fs.existsSync(path.join(__dirname, "../client/node_modules"));
});

// Run async checks
(async () => {
  // Database check
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    checks.push({ name: "Database connection", passed: true, error: null });
    await prisma.$disconnect();
  } catch (error) {
    checks.push({ name: "Database connection", passed: false, error: error.message });
    allPassed = false;
  }

  // Redis check
  try {
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    await redis.ping();
    checks.push({ name: "Redis connection", passed: true, error: null });
    await redis.quit();
  } catch (error) {
    checks.push({ name: "Redis connection", passed: false, error: error.message });
    allPassed = false;
  }

  // Print results
  console.log("\n📋 Results:\n");
  checks.forEach(({ name, passed, error }) => {
    const icon = passed ? "✅" : "❌";
    console.log(`${icon} ${name}`);
    if (error) {
      console.log(`   Error: ${error}`);
    }
  });

  console.log("\n" + "=".repeat(50));
  if (allPassed) {
    console.log("✅ All checks passed! You're ready to go.");
  } else {
    console.log("❌ Some checks failed. Please fix the issues above.");
    console.log("\nNext steps:");
    console.log("1. Copy ENV_TEMPLATE.txt to .env");
    console.log("2. Fill in all required values");
    console.log("3. Run: npm install");
    console.log("4. Run: npm run prisma:generate");
    console.log("5. Run: npm run prisma:migrate");
    console.log("\nSee TESTING_GUIDE.md for detailed instructions.");
  }
  console.log("=".repeat(50) + "\n");
})();




