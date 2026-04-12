import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow cross-origin requests from the backend during dev
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
  // Turbopack is default in Next.js 16 — empty config silences the warning
  turbopack: {},
};

export default nextConfig;
