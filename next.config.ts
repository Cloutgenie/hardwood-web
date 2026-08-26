import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/base-path";

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  outputFileTracingIncludes: {
    "/api/players": ["./data/**"],
    [`${BASE_PATH}/api/players`]: ["./data/**"],
    "/build": ["./data/**"],
    "/": ["./data/**"],
  },
};

export default nextConfig;
