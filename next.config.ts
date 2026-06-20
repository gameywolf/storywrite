import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native module + driver adapter must not be bundled by the server build.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
};

export default nextConfig;
