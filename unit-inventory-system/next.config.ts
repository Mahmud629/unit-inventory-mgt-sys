import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,

  // Native module: keep it out of the server bundle.
  serverExternalPackages: ["better-sqlite3"],

  async redirects() {
    // The old Add / Edit / Remove page is now part of the register.
    return [{ source: "/manage", destination: "/inventory", permanent: false }];
  },

  async rewrites() {
    // Runs after public/ files are checked, so uploads that existed at build
    // time are served directly and newer ones go through the API route.
    return [{ source: "/uploads/:name", destination: "/api/files/:name" }];
  },

  async headers() {
    return [
      {
        source: "/uploads/:name",
        headers: [
          { key: "Cache-Control", value: "private, max-age=604800, immutable" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
