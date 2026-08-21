/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents duplicate socket connections in dev mode
  swcMinify: true,
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma", "iconv-lite"]
  }
};

export default nextConfig;
