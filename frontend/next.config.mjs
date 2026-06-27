import { createRequire } from "module";

const require = createRequire(import.meta.url);
const bufferPath = require.resolve("buffer/");
const processPath = require.resolve("process/browser");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The /api/issue route runs Noir server-side to compute the Poseidon
  // commitment. Keep these out of the server bundle so Node require()s them
  // from node_modules and resolves their CJS/"nodejs" entry points, which read
  // the WASM from disk with fs. If bundled, webpack picks the "web" build that
  // fetch()es the WASM via a /_next/... URL, which has no base on the server
  // ("Failed to parse URL from /_next/static/media/...wasm").
  experimental: {
    serverComponentsExternalPackages: [
      "@noir-lang/noir_js",
      "@noir-lang/acvm_js",
      "@noir-lang/noirc_abi",
    ],
  },

  // Noir + Barretenberg (bb.js) prove in WASM in the browser. They expect Node
  // globals (Buffer/process) and load WASM modules; these settings make the
  // client bundle work without server-side polyfills.
  webpack: (config, { webpack }) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: bufferPath,
      process: processPath,
    };
    config.plugins.push(
      new webpack.ProvidePlugin({
        Buffer: ["buffer", "Buffer"],
        process: processPath,
      }),
    );
    return config;
  },

  // NOTE: We intentionally do NOT set Cross-Origin-Opener/Embedder-Policy.
  // Those headers enable SharedArrayBuffer (crossOriginIsolated), which makes
  // bb.js take its *multithreaded* path. That path spawns a Web Worker from
  // @aztec/bb.js's prebuilt main.worker.js bundle via `new Worker(new URL(...))`.
  // Next.js's webpack re-wraps that already-bundled file and corrupts its inner
  // module runtime, throwing "Object.defineProperty called on non-object" the
  // moment you generate a proof. Without these headers, getSharedMemoryAvailable()
  // is false, so bb.js runs single-threaded: it only loads barretenberg.js (a
  // trivial one-line module exporting the wasm as a data URI) and never touches
  // the worker. Slower proving, but it actually runs. See lib/proof.ts.
};

export default nextConfig;
