import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output is what the Dockerfile copies into the runtime image.
  output: "standalone",
  // The portal holds no secrets of its own, but the API token lives in an
  // httpOnly cookie, so nothing here should ever be exposed as NEXT_PUBLIC_.
};

export default nextConfig;
