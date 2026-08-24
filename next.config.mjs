/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents duplicate socket connections in dev mode
  swcMinify: true,
  allowedDevOrigins: [
    "openbon.local",
    "openbon.local:3000",
    "openbon.local:80",
    "localhost:3000",
    "127.0.0.1:3000"
  ],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma", "iconv-lite"]
  }
};

export default nextConfig;
