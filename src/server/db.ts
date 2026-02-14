import { PrismaClient } from "@prisma/client";
import { env } from "~/server/env";
// Prisma client regenerated with Task Management models

const createPrismaClient = () => {
  const isDevelopment = env.NODE_ENV === "development";
  return new PrismaClient({
    log: isDevelopment ? ["query", "error", "warn"] : ["error"],
  });
};

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

let _db: PrismaClient | null = null;

function getDb(): PrismaClient {
  if (_db === null) {
    _db = globalForPrisma.prisma ?? createPrismaClient();
    const isDevelopment = env.NODE_ENV !== "production";
    if (isDevelopment) {
      globalForPrisma.prisma = _db;
    }
  }
  return _db;
}

// Export a Proxy that lazily initializes the database client
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const value = client[prop as keyof PrismaClient];
    // If it's a function, bind it to the client
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
