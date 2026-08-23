/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Allow importing .csv files as raw text strings via the ?raw suffix.
  // Used by src/lib/productCatalog.ts to bundle the product catalog at
  // build time without a separate API route.
  webpack(config) {
    config.module.rules.push({
      resourceQuery: /raw/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
