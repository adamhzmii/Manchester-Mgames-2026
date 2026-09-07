import type { MetadataRoute } from "next";

/**
 * Web app manifest. Next serves this at /manifest.webmanifest and links it
 * from every page automatically.
 *
 * `display: standalone` is the point of the exercise: on the day people check
 * scores dozens of times, and a home-screen icon that opens without browser
 * chrome is a materially different experience from a tab someone has to go
 * find. It is also a precondition for push notifications on iOS, which only
 * permits them once a site has been added to the home screen.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MGames 2026 · Manchester",
    short_name: "MGames 26",
    description:
      "Live schedule, scores, venue maps and food for Manchester MGames 2026.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F2F8",
    theme_color: "#3c2a6e",
    categories: ["sports", "events"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Separate maskable entry: Android crops icons to its own shape, and an
      // "any" icon cropped that way loses the edges of the crest.
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
