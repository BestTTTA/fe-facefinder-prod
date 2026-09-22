import type { NextConfig } from "next";

// Where the FastAPI backend lives, as seen from the Next server (not the browser).
const API_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // Proxy the API through this origin so the portal works from a phone or a
  // tunnel without any CORS setup — the browser only ever talks to this host.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_TARGET}/api/:path*` },
      { source: "/health", destination: `${API_TARGET}/health` },
    ];
  },
};

export default nextConfig;
