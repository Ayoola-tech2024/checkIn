import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "http://21.0.11.32:81",
    "http://21.0.11.32:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://preview-chat-e4af0c47-5c37-4365-98cf-7b7c08f61c4c.space-z.ai",
  ],
};

export default nextConfig;
