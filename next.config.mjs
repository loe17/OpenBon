import path from 'path';

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
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    // Verhindert ENOSPC (Disk Full durch Webpack PackFileCache) auf RPi und kleinen Servern
    config.cache = false;
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(process.cwd(), 'src'),
    };
    return config;
  },
  experimental: {
    // WICHTIG (Next.js 14): Ohne diesen Schalter wird `src/instrumentation.ts`
    // gar nicht ausgefuehrt. Genau dort werden das JWT-Session-Secret erzeugt
    // sowie Diagnose-, Aufraeum- und Backup-Zyklus gestartet - ohne den Hook
    // liefen alle vier still ins Leere.
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@prisma/client", "prisma", "iconv-lite"]
  }
};

export default nextConfig;
