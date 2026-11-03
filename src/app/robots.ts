import type { MetadataRoute } from "next";

// Lessons and the public pages are for search engines; accounts, classes,
// messages and calls are not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/", "/admin", "/teacher", "/classes", "/messages", "/groups", "/room/", "/profile",
        "/notebook", "/workspace", "/tutor-hub", "/console", "/demo/", "/calendar", "/certificate",
      ],
    },
    sitemap: "https://learn.algebridge.org/sitemap.xml",
  };
}
