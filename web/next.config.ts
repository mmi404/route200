import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      // A single "*.css" glob also matches "*.module.css" (globs match on
      // file name, and "*" is greedy), so without this split every CSS
      // Module in the app was being forced through as plain global CSS
      // ("as: *.css"), which drops Turbopack's css-module scoping entirely:
      // `import styles from "./x.module.css"` resolved to an empty object,
      // so every className using it (date-range-slider.module.css, the only
      // CSS Module in this codebase) rendered as "". Split by the documented
      // "advanced webpack loader conditions" array form so module files keep
      // their built-in css-module processing while still running through
      // the Tailwind loader for design-token var() access.
      "*.css": [
        {
          condition: { path: /\.module\.css$/ },
          loaders: ["@tailwindcss/turbopack"],
          as: "*.module.css",
        },
        {
          condition: { not: { path: /\.module\.css$/ } },
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      ],
    },
  },
};

export default nextConfig;
