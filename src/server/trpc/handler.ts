import { defineEventHandler } from "h3";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./root";

export default defineEventHandler(async (event) => {
  // Debug endpoint for testing Anthropic API
  if (event.node.req.url?.includes('/test-anthropic')) {
    console.log('[Test Anthropic] Handler called');
    try {
      const { generateText } = await import('ai');
      const { anthropic } = await import('@ai-sdk/anthropic');
      
      console.log('[Test Anthropic] Modules imported');
      const apiKey = process.env.ANTHROPIC_API_KEY;
      console.log('[Test Anthropic] API Key length:', apiKey?.length || 0);
      console.log('[Test Anthropic] API Key first 12 chars:', apiKey?.substring(0, 12) || 'MISSING');
      
      const model = anthropic('claude-4-5-haiku');
      console.log('[Test Anthropic] Client created');
      
      const result = await generateText({
        model,
        system: 'You are helpful.',
        messages: [{ role: 'user', content: 'Say hi.' }],
      });
      
      console.log('[Test Anthropic] Success!');
      return new Response(JSON.stringify({ success: true, response: result.text }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error('[Test Anthropic] ERROR:', error instanceof Error ? error.message : String(error));
      return new Response(JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.substring(0, 200) : 'N/A'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const nodeReq = event.node.req;
    const method = nodeReq.method || "GET";
    const headers = new Headers();
    
    // Copy Node.js request headers to Fetch Headers
    if (nodeReq.headers) {
      for (const [key, value] of Object.entries(nodeReq.headers)) {
        if (value != null) {
          headers.set(key, Array.isArray(value) ? value.join(",") : String(value));
        }
      }
    }

    const host = nodeReq.headers.host || "localhost";
    let pathname = nodeReq.url || "/";
    
    // Ensure the path includes /trpc prefix for tRPC routing
    if (!pathname.startsWith("/trpc")) {
      pathname = `/trpc${pathname}`;
    }
    
    const url = `http://${host}${pathname}`;

    // For POST/PUT/PATCH, read the body from the Node.js request stream directly
    let body: any = undefined;
    if (method !== "GET" && method !== "HEAD") {
      body = await new Promise<Buffer | undefined>((resolve) => {
        let data = Buffer.alloc(0);
        nodeReq.on("data", (chunk: Buffer) => {
          data = Buffer.concat([data, chunk]);
        });
        nodeReq.on("end", () => {
          resolve(data.length > 0 ? data : undefined);
        });
        nodeReq.on("error", () => {
          resolve(undefined);
        });
      });
    }

    const request = new Request(url, {
      method,
      headers,
      body,
    });

    // DEBUG: Log the request details
    console.log(`[tRPC] ${method} ${pathname}, body size: ${body?.length || 0}`);
    if (body && body.length > 0) {
      try {
        const bodyStr = body.toString('utf-8');
        console.log(`[tRPC] Body content (first 500 chars): ${bodyStr.substring(0, 500)}`);
        if (pathname.includes('updateOrderStatus')) {
          console.log(`[tRPC] *** FULL updateOrderStatus REQUEST ***`);
          console.log(bodyStr);
        }
      } catch (e) {
        console.log('[tRPC] Could not convert body to string');
      }
    }

    return await fetchRequestHandler({
      endpoint: "/trpc",
      req: request,
      router: appRouter,
      createContext() {
        return {};
      },
      onError({ error, path }) {
        console.error(`[tRPC] error on path '${path}':`, error?.message || error);
      },
    });
  } catch (error) {
    console.error("[tRPC handler] fatal error:", error);
    return new Response(
      JSON.stringify({
        error: { message: "Internal server error", code: "INTERNAL_SERVER_ERROR" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
