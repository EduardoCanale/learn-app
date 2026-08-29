import type { NextConfig } from "next";

// Workspaces hold user learning data, not source. Keep the dev server's file
// watcher off them so a /teach session writing lessons doesn't trigger reloads.
const config: NextConfig = {
  webpack: (cfg) => {
    cfg.watchOptions = { ...cfg.watchOptions, ignored: ["**/workspaces/**", "**/node_modules/**"] };
    return cfg;
  },
};

export default config;
