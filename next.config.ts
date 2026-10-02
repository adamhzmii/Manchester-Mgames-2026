import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a matchday rehearsal (MGAMES_DEMO, see src/lib/demo.ts) run beside
  // the normal dev server: Next refuses a second `next dev` sharing one build
  // directory, so the rehearsal gets its own.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

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
