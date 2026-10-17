import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // Pin the root: a stray lockfile in a parent directory otherwise makes Turbopack scan it.
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // postgres.js and the Solana SDK are Node-only; don't bundle them.
  serverExternalPackages: ["postgres", "@solana/web3.js"],
};

export default nextConfig;
