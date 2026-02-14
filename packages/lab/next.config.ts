import path from "node:path";
import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

const repoRoot = path.resolve(__dirname, "..", "..");
loadEnvConfig(repoRoot);

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    externalDir: true,
  },
  transpilePackages: ["@judge-gym/engine"],
  env: {
    NEXT_PUBLIC_CONVEX_URL: convexUrl,
  },
};

export default nextConfig;
