import { eventHandler } from "h3";
import { db } from "~/server/db";

let dbConnectionEstablished = false;
let lastHealthCheckTime: Date | null = null;
let consecutiveFailures = 0;
let lastError: string | null = null;

export default eventHandler(async (event) => {
  const startTime = Date.now();
  
  try {
    // Create a promise that will timeout after 5 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Database health check timeout")), 5000);
    });

    // Verify database connectivity with a simple query
    const queryPromise = db.$executeRawUnsafe("SELECT 1");
    
    // Race between the query and the timeout
    await Promise.race([queryPromise, timeoutPromise]);
    
    // Mark that we've successfully connected to the database
    dbConnectionEstablished = true;
    lastHealthCheckTime = new Date();
    consecutiveFailures = 0;
    lastError = null;
    
    const responseTime = Date.now() - startTime;
    
    console.log(`[Health Check] OK - Response time: ${responseTime}ms`);
    
    // Set response headers
    event.node.res.setHeader("Content-Type", "application/json");
    event.node.res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    event.node.res.statusCode = 200;
    
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        database: "connected",
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };
  } catch (error) {
    consecutiveFailures++;
    const responseTime = Date.now() - startTime;
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorType = error instanceof Error ? error.constructor.name : "UnknownError";
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    lastError = `${errorType}: ${errorMessage}`;
    
    console.error(
      `[Health Check] FAILED (${consecutiveFailures} consecutive failures) - ` +
      `Response time: ${responseTime}ms - ` +
      `Error: ${errorType}: ${errorMessage}`
    );
    
    if (errorStack) {
      console.error(`[Health Check] Stack trace:`, errorStack);
    }
    
    // If we've never established a database connection, this is likely a startup issue
    if (!dbConnectionEstablished) {
      console.error(
        "[Health Check] WARNING: Database connection has never been established. " +
        "This may indicate a configuration or network issue."
      );
      console.error(
        "[Health Check] Database connection string: " +
        (process.env.DATABASE_URL ? "Set (hidden for security)" : "NOT SET")
      );
    }
    
    // Set error response headers
    event.node.res.setHeader("Content-Type", "application/json");
    event.node.res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    event.node.res.statusCode = 503;
    
    return {
      status: "error",
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        database: "disconnected",
      },
      error: errorMessage,
      errorType: errorType,
      consecutiveFailures: consecutiveFailures,
      dbEverConnected: dbConnectionEstablished,
      lastSuccessfulCheck: lastHealthCheckTime?.toISOString() || null,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };
  }
});
