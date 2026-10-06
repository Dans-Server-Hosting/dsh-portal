import type { Metadata } from "next";

// The portal's production origin. It is a constant rather than an env var so
// canonical links, og:url, robots.txt and sitemap.xml can never be built with
// a localhost or request-derived origin (PORTAL_URL is localhost in the smoke
// test, and a missing build-time env var once shipped localhost URLs on
// dansplugins.com).
export const SITE_URL = "https://dansserverhosting.com";
export const SITE_NAME = "Dan's Server Hosting";
export const SITE_DESCRIPTION =
  "A free Minecraft server for you and your friends: sign in, press Create server, get an address to hand out. It sleeps when nobody is playing and wakes when someone joins.";

/** Pages a signed-out visitor (or a crawler) can reach; the sitemap lists exactly these. */
export const PUBLIC_PATHS = ["/", "/auth/login", "/auth/register"] as const;

/**
 * Metadata for one public page: a canonical link and Open Graph / Twitter
 * tags whose URL is that page. Next.js replaces (not merges) a parent's
 * openGraph object, so every field is set here.
 */
export function publicPageMetadata(path: (typeof PUBLIC_PATHS)[number], title?: string, description = SITE_DESCRIPTION): Metadata {
  const shareTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url: path,
      title: shareTitle,
      description,
    },
    twitter: { card: "summary", title: shareTitle, description },
  };
}
