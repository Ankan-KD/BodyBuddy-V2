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

  // CSV files are the app's data source of truth (src/data/*.csv). Importing
  // one — `import text from "@/data/foo.csv"` — gives you its raw text,
  // bundled into the JS at build time (not served from /public). Both
  // bundlers are configured so it works with `next dev`, `next build`
  // (Turbopack is the default in Next 16) and `--webpack` alike.
  //
  // Turbopack config — handles *.csv imports via raw-loader.
  turbopack: {
    rules: {
      "*.csv": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },

  // Webpack config — used when running with `--webpack`. Turbopack ignores
  // this block entirely. Covers plain `.csv` imports as well as `?raw`.
  webpack(config) {
    config.module.rules.push({
      test: /\.csv$/i,
      type: "asset/source",
    });
    config.module.rules.push({
      resourceQuery: /raw/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;