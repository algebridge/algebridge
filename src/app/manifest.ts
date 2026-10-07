import type { MetadataRoute } from "next";

/**
 * AlgeBridge as an app on a phone's home screen. On an iPhone this is also
 * what lets it send notifications: Safari only allows them for a site added
 * to the Home Screen and opened from there.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AlgeBridge",
    short_name: "AlgeBridge",
    description: "Free Algebra 1, start to finish.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2563eb",
    icons: [
      { src: "/brand/app-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/app-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
