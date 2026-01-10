import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const unenvPackageJsonPath = path.join(projectRoot, "node_modules", "unenv", "package.json");

if (!fs.existsSync(unenvPackageJsonPath)) {
  console.error(`[patch-unenv-exports] Not found: ${unenvPackageJsonPath}`);
  process.exit(1);
}

/**
 * Patch `unenv` export map so subpath imports used by node-stdlib-browser resolve.
 *
 * We only add exports if missing; safe to run repeatedly.
 */
const raw = fs.readFileSync(unenvPackageJsonPath, "utf8");
const pkg = JSON.parse(raw);

pkg.exports ??= {};

const ensureExport = (key, value) => {
  if (pkg.exports[key] == null) {
    pkg.exports[key] = value;
  }
};

// File-style shims like `unenv/npm/debug` -> `dist/runtime/npm/debug.mjs`
// Note: Some npm shims are directories (e.g. whatwg-url). We handle that below
// by creating a file shim so this export pattern works reliably.
ensureExport("./npm/*", {
  types: "./dist/runtime/npm/*.d.mts",
  default: "./dist/runtime/npm/*.mjs",
});

// Some dependency trees still try this legacy path.
// We map it to the existing mock proxy entry as a best-effort fallback.
ensureExport("./mock/empty", {
  types: "./lib/mock.d.cts",
  default: "./lib/mock.cjs",
});

// Ensure directory-style npm shims can be imported via `unenv/npm/<name>`.
// Example: `unenv/npm/whatwg-url` should resolve to `dist/runtime/npm/whatwg-url.mjs`.
const ensureFile = (relativePath, content) => {
  const fullPath = path.join(projectRoot, "node_modules", "unenv", relativePath);
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, content, "utf8");
  }
};

ensureFile(
  "dist/runtime/npm/whatwg-url.mjs",
  'export * from "./whatwg-url/index.mjs";\n'
);
ensureFile(
  "dist/runtime/npm/whatwg-url.d.mts",
  'export * from "./whatwg-url/index.d.mts";\n'
);

fs.writeFileSync(unenvPackageJsonPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");

console.log("[patch-unenv-exports] Patched:", path.relative(projectRoot, unenvPackageJsonPath));
