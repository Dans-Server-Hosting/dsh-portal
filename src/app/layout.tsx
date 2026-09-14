import type { Metadata, Viewport } from "next";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import ThemeRegistry from "@/components/ThemeRegistry";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: { default: "Dan's Server Hosting", template: "%s · Dan's Server Hosting" },
  description: "Sign in, press Create server, get an address to give your friends, see when it's awake.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
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
            </Box>
          </Box>
        </ThemeRegistry>
      </body>
    </html>
  );
}
