import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle the JSON "DB" and seeds with every API route so Netlify/Vercel
  // serverless functions can find them at runtime.
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/**/*", "./seeds/**/*"],
  },
};

export default nextConfig;
