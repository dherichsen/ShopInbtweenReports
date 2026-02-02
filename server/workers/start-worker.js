require("dotenv").config();

console.log("🟠 [WORKER] Starting worker process...");
console.log("🟠 [WORKER] DATABASE_URL:", process.env.DATABASE_URL ? "SET" : "MISSING");
console.log("🟠 [WORKER] REDIS_URL:", process.env.REDIS_URL ? "SET" : "MISSING");

require("./reportWorker");

console.log("🟠 [WORKER] Report worker process started. Press Ctrl+C to stop.");

