import { createApp } from "vinxi";
import reactRefresh from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { config } from "vinxi/plugins/config";
import { consoleForwardPlugin } from "./vite-console-forward-plugin";
import { config as dotenvConfig } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get the directory name of the current module
// @ts-ignore - This file runs in an ESM context (Vinxi/Vite) even if tsconfig module differs.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file with explicit path
dotenvConfig({ path: join(__dirname, '.env') });

export default createApp({
  server: {
    preset: "node-server",
    experimental: {
      asyncContext: true,
    },
    // @ts-ignore - Supported by Vinxi runtime config.
    port: parseInt(process.env.PORT || "3000"),
    // @ts-ignore - Supported by Vinxi runtime config.
    host: process.env.HOST || "0.0.0.0",
  },
  routers: [
    {
      type: "static",
      name: "public",
      dir: "./public",
    },
    {
      type: "http",
      name: "health",
      base: "/health/",
      handler: "./src/server/health/handler.ts",
      target: "server",
      plugins: () => [
        config("allowedHosts", {
          // @ts-ignore
          server: {
            allowedHosts: true,
          },
        }),
        config("external", {
          build: {
            rollupOptions: {
              external: ["h3"],
            },
          },
        }),
        tsConfigPaths({
          projects: ["./tsconfig.json"],
        }),
      ],
    },
    {
      type: "http",
      name: "trpc",
      base: "/trpc/",
      handler: "./src/server/trpc/handler.ts",
      target: "server",
      plugins: () => [
        config("allowedHosts", {
          // @ts-ignore
          server: {
            allowedHosts: true,
          },
        }),
        config("external", {
          build: {
            rollupOptions: {
              external: ["h3", "bcrypt"],
            },
          },
        }),
        tsConfigPaths({
          projects: ["./tsconfig.json"],
        }),
      ],
    },
    {
      type: "http",
      name: "debug",
      base: "/api/debug/client-logs/",
      handler: "./src/server/debug/client-logs-handler.ts",
      target: "server",
      plugins: () => [
        config("allowedHosts", {
          // @ts-ignore
          server: {
            allowedHosts: true,
          },
        }),
        config("external", {
          build: {
            rollupOptions: {
              external: ["h3"],
            },
          },
        }),
        tsConfigPaths({
          projects: ["./tsconfig.json"],
        }),
      ],
    },
    {
      type: "http",
      name: "payfast-notify",
      base: "/api/payments/payfast/notify/",
      handler: "./src/server/payments/payfast-notify-handler.ts",
      target: "server",
      plugins: () => [
        config("allowedHosts", {
          // @ts-ignore
          server: {
            allowedHosts: true,
          },
        }),
        config("external", {
          build: {
            rollupOptions: {
              external: ["h3"],
            },
          },
        }),
        tsConfigPaths({
          projects: ["./tsconfig.json"],
        }),
      ],
    },
    {
      type: "spa",
      name: "client",
      handler: "./index.html",
      target: "browser",
      plugins: () => [
        config("allowedHosts", {
          // @ts-ignore
          server: {
            allowedHosts: true,
          },
        }),
        tsConfigPaths({
          projects: ["./tsconfig.json"],
        }),
        TanStackRouterVite({
          target: "react",
          autoCodeSplitting: true,
          routesDirectory: "./src/routes",
          generatedRouteTree: "./src/generated/routeTree.gen.ts",
        }),
        reactRefresh(),
        consoleForwardPlugin({
          enabled: true,
          endpoint: "/api/debug/client-logs",
          levels: ["log", "warn", "error", "info", "debug"],
        }),
      ],
    },
  ],
});
