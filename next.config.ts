import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle the JSON "DB" and seeds with every API route so serverless
  // function bundlers (Vercel, AWS Lambda, etc.) include them at build time.
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/**/*", "./seeds/**/*"],
  },
};

export default nextConfig;
