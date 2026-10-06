import type { Metadata, Viewport } from "next";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import ThemeRegistry from "@/components/ThemeRegistry";
import SiteHeader from "@/components/SiteHeader";
import { DEFAULT_MODE } from "@/lib/color-mode";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  icons: { icon: "/favicon.svg" },
  // Pages without their own (the signed-in ones) still share as the site; no
  // og:url here, since a child would otherwise inherit "/" as its URL.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: InitColorSchemeScript sets data-dark / data-light
    // on <html> before React hydrates, so the attribute differs from the SSR markup.
    <html lang="en" suppressHydrationWarning>
      <body>
        <InitColorSchemeScript attribute="data" defaultMode={DEFAULT_MODE} />
        <ThemeRegistry>
          <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
            <SiteHeader />
            <Container component="main" maxWidth="md" sx={{ flex: 1, py: { xs: 3, sm: 5 }, px: { xs: 2, sm: 3 } }}>
              {children}
            </Container>
            <Box component="footer" sx={{ borderTop: 1, borderColor: "divider", py: 2, px: 2, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                Dan&apos;s Server Hosting ·{" "}
                <Link href="https://github.com/Dans-Server-Hosting/dsh-portal" color="inherit">
                  source
                </Link>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                More by Daniel Stephenson →{" "}
                <Link href="https://danielstephenson.dev" color="inherit" data-testid="author-backlink">
                  danielstephenson.dev
                </Link>
              </Typography>
            </Box>
          </Box>
        </ThemeRegistry>
      </body>
    </html>
  );
}
