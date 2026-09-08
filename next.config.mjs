/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Produces a self-contained `.next/standalone` build (server + only the
  // node_modules actually needed at runtime) — this is what the Docker
  // image copies into the final runtime stage, keeping it small.
  // Uncomment for Docker/self-hosted deployment (see Dockerfile) — Vercel
  // errors with this enabled, so keep it commented out for Vercel builds.
  // output: "standalone",


  
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http",  hostname: "**" },
    ],
  },

  // Turbopack config — handles *.csv imports via raw-loader so the catalog
  // CSV is bundled into the JS at build time (not served from /public).
  turbopack: {
    rules: {
      "*.csv": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },

  // Webpack config — used by `next build` (production) and `next dev --webpack`.
  // Turbopack ignores this block entirely.
  webpack(config) {
    config.module.rules.push({
      resourceQuery: /raw/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;