#!/usr/bin/env node
/**
 * Fail fast if user is in the wrong repo or missing host tooling.
 * Used by: npm run preflight | npm run tauri:dev
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = resolve(root, "package.json");

function die(msg) {
  console.error("\n[preflight] " + msg + "\n");
  process.exit(1);
}

if (!existsSync(pkgPath)) die("No package.json — run from agent-commandcenter root.");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
if (pkg.name !== "agent-commandcenter") {
  die(
    `Wrong package: "${pkg.name}".\n` +
      `  Tauri lives in jtmilan/agent-commandcenter — not ade-api.\n` +
      `  cd ../agent-commandcenter  then  npm run tauri:dev`,
  );
}

if (!existsSync(resolve(root, "src-tauri/tauri.conf.json"))) {
  die("Missing src-tauri/ — pull latest main.");
}

if (!existsSync(resolve(root, "src-tauri/icons/icon.png"))) {
  die("Missing src-tauri/icons — pull latest main (icons are required for tauri).");
}

try {
  execSync("rustc --version", { stdio: "pipe" });
} catch {
  die(
    "Rust not found. Install: https://rustup.rs/\n" +
      "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
  );
}

try {
  execSync("cargo --version", { stdio: "pipe" });
} catch {
  die("cargo not found — complete Rust install and open a new terminal.");
}

const hasCli =
  existsSync(resolve(root, "node_modules/@tauri-apps/cli")) ||
  existsSync(resolve(root, "node_modules/.bin/tauri"));
if (!hasCli) {
  console.warn(
    "[preflight] @tauri-apps/cli not installed yet — run:\n" +
      "  npm install -D @tauri-apps/cli@2 @tauri-apps/api@2",
  );
}

console.log("[preflight] ok · agent-commandcenter · rust present · src-tauri ready");
