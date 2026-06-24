/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Noir/bb proof generation runs in WASM in the browser. These let the
  // client bundle load the WASM modules without server-side polyfills.
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

export default nextConfig;
