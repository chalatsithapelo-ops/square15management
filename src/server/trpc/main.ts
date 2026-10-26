import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

const t = initTRPC.create({
  transformer: superjson,
  sse: {
    enabled: true,
    client: {
      reconnectAfterInactivityMs: 5000,
    },
    ping: {
      enabled: true,
      intervalMs: 2500,
    },
  },
  errorFormatter({ shape, error }) {
    // Forward plain-object `cause` payloads to the client so procedures can
    // signal recoverable states (duplicate job, active job, etc.) with
    // structured data the UI can act on.
    const rawCause = (error as any).cause;
    const serializableCause =
      rawCause && typeof rawCause === "object" && !(rawCause instanceof Error)
        ? rawCause
        : null;
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
        cause: serializableCause,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const baseProcedure = t.procedure;
export const publicProcedure = t.procedure;
