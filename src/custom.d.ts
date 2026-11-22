// ── CSV raw import declarations ───────────────────────────────────────────
// Tells TypeScript that any `import x from "…/foo.csv?raw"` returns a string
// (the raw CSV text, bundled by webpack asset/source or raw-loader).
declare module "*.csv?raw" {
  const content: string;
  export default content;
}

// A CSV imported without the ?raw suffix (e.g. the Master Food Database in
// src/lib/masterFoods.ts) is also its raw text. next.config.mjs wires up the
// loader for both Turbopack and webpack.
declare module "*.csv" {
  const content: string;
  export default content;
}
