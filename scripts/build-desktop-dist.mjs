#!/usr/bin/env node
/**
 * Produce a static folder for Tauri `frontendDist`.
 * TanStack Start + Nitro emit `.vercel/output/static` (assets only under SSR).
 * We add a thin index.html shell so the webview can boot the client bundle.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist-desktop");
const staticDir = join(root, ".vercel/output/static");

console.log("[desktop-dist] building frontend…");
execSync("npm run build", { cwd: root, stdio: "inherit" });

if (!existsSync(staticDir)) {
  console.error("[desktop-dist] missing .vercel/output/static after build");
  process.exit(1);
}

if (existsSync(out)) rmSync(out, { recursive: true });
mkdirSync(out, { recursive: true });
cpSync(staticDir, out, { recursive: true });

const assetsDir = join(out, "assets");
const files = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
const js = files.find((f) => f.startsWith("index-") && f.endsWith(".js"));
const css = files.find((f) => f.startsWith("styles-") && f.endsWith(".css"));

if (!js) {
  console.error("[desktop-dist] no index-*.js in assets — check Vite client build");
  process.exit(1);
}

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agent Command Center</title>
    ${css ? `<link rel="stylesheet" href="/assets/${css}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/${js}"></script>
  </body>
</html>
`;

writeFileSync(join(out, "index.html"), html);
console.log("[desktop-dist] ready →", out, "entry", js);
