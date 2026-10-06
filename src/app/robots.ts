import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Signed-in pages and the portal's own API are of no use to a search engine.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/servers", "/account", "/feedback", "/admin/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
