// Copies @aztec/bb.js's prebuilt browser bundle into public/bb so the in-browser
// prover can load it as a *native* ES module (see lib/proof.ts), bypassing
// Next.js/webpack entirely.
//
// Why: @aztec/bb.js ships dest/browser/{index,barretenberg,main.worker,...}.js
// as already-bundled files. UltraHonkBackend always spawns a Web Worker via
// `new Worker(new URL("./main.worker.js", import.meta.url), { type: "module" })`.
// If webpack re-processes that prebuilt worker bundle it corrupts its internal
// module runtime and proving throws "Object.defineProperty called on non-object".
// Serving the files from /public/bb and importing index.js with `webpackIgnore`
// lets the browser resolve main.worker.js / barretenberg.js relative to it,
// untouched by the bundler.
//
// Runs automatically on predev/prebuild so the copy can never drift from the
// installed version.

import { cpSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// bb.js's package.json "exports" doesn't expose "./package.json", so resolve the
// main entry instead and derive the package root from its path (the entry lives
// under <root>/dest/...). Handles pnpm's symlinked layout.
const mainEntry = require.resolve("@aztec/bb.js");
const marker = `${sep}dest${sep}`;
const pkgRoot = mainEntry.slice(0, mainEntry.indexOf(marker));
const srcDir = join(pkgRoot, "dest", "browser");
const destDir = join(here, "..", "public", "bb");

rmSync(destDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });
cpSync(srcDir, destDir, { recursive: true });

// Read package.json directly off disk (bypasses the "exports" restriction).
const { version } = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf-8"));
console.log(`[copy-bb] copied @aztec/bb.js@${version} browser bundle -> public/bb`);
