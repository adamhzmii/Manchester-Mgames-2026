import { networkInterfaces } from "node:os";

import type { NextConfig } from "next";

/**
 * This machine's own addresses on the local network. `next dev` refuses its
 * scripts to any other origin, so opening the dev server from a phone on the
 * same wifi — how the mobile experience actually gets tried — loaded the page
 * but never hydrated it. Development only; production ignores the setting.
 */
function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net !== undefined && net.family === "IPv4" && !net.internal)
    .map((net) => net!.address);
}

const nextConfig: NextConfig = {
  // Lets a matchday rehearsal (MGAMES_DEMO, see src/lib/demo.ts) run beside
  // the normal dev server: Next refuses a second `next dev` sharing one build
  // directory, so the rehearsal gets its own.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  allowedDevOrigins: lanAddresses(),

  // The first version's routes, renamed to what people actually call them.
  // Links already shared in group chats, and push notifications already on
  // phones, keep working.
  async redirects() {
    return [
      { source: "/scores", destination: "/standings", permanent: true },
      { source: "/map", destination: "/venues", permanent: true },
      { source: "/announcements", destination: "/updates", permanent: true },
    ];
  },
};

export default nextConfig;
