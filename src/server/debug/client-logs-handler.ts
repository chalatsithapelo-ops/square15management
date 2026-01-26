import { eventHandler, getMethod } from "h3";

interface LogEntry {
  level: string;
  message: string;
  timestamp: Date;
  url?: string;
  userAgent?: string;
  stacks?: string[];
  extra?: any;
}

interface ClientLogRequest {
  logs: LogEntry[];
}

const handler = eventHandler(async (event) => {
  const req = event.node.req;
  const res = event.node.res;

  if (getMethod(event) !== "POST") {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  return new Promise((resolve) => {
    let body = "";
    req.setEncoding("utf8");

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      try {
        const { logs } = JSON.parse(body) as ClientLogRequest;

        if (!logs || !Array.isArray(logs)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid log format" }));
          return resolve(null);
        }

        // Forward each log to the server console
        logs.forEach((log) => {
          const timestamp = new Date(log.timestamp).toLocaleTimeString();
          const location = log.url ? ` (${log.url})` : "";
          const prefix = `[browser] [${timestamp}]`;

          let message = `${prefix} [${log.level}] ${log.message}${location}`;

          // Add stack traces if available
          if (log.stacks && log.stacks.length > 0) {
            message +=
              "\n" +
              log.stacks
                .map((stack) =>
                  stack
                    .split("\n")
                    .map((line) => `    ${line}`)
                    .join("\n"),
                )
                .join("\n");
          }

          // Add extra data if available
          if (log.extra && log.extra.length > 0) {
            message +=
              "\n    Extra data: " +
              JSON.stringify(log.extra, null, 2)
                .split("\n")
                .map((line, i) => (i === 0 ? line : `    ${line}`))
                .join("\n");
          }

          // Log to server console based on level
          switch (log.level) {
            case "error":
              console.error(message);
              break;
            case "warn":
              console.warn(message);
              break;
            case "info":
              console.info(message);
              break;
            case "debug":
              console.log(message);
              break;
            default:
              console.log(message);
          }
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
        resolve(null);
      } catch (error) {
        console.error("Error processing client logs:", error);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        resolve(null);
      }
    });

    req.on("error", (error) => {
      console.error("Error reading client logs request stream:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
      resolve(null);
    });
  });
});

// NOTE: Nitro/h3 in production currently expects this marker to avoid
// emitting the "Implicit event handler conversion" deprecation warning.
(handler as any).__is_handler__ = true;

export default handler;
