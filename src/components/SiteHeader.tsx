import Link from "next/link";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import DnsIcon from "@mui/icons-material/Dns";
import { getSession } from "@/lib/session";

export default async function SiteHeader() {
  const session = await getSession();
  return (
    <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.paper" }}>
      <Toolbar sx={{ gap: 1, flexWrap: "wrap", px: { xs: 2, sm: 3 } }}>
        <Box
          component={Link}
          href="/"
          sx={{ display: "flex", alignItems: "center", gap: 1, color: "inherit", textDecoration: "none", mr: "auto", minWidth: 0 }}
        >
          <DnsIcon color="primary" />
          <Typography variant="h6" component="span" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
            Dan&apos;s Server Hosting
          </Typography>
        </Box>
        {session ? (
          <>
            <Button component={Link} href="/servers" size="small">
              My servers
            </Button>
            <Box component="form" action="/auth/signout" method="post" sx={{ display: "contents" }}>
              <Button type="submit" size="small" variant="outlined" color="inherit">
                Sign out
              </Button>
            </Box>
          </>
        ) : (
          <Button component={Link} href="/auth/login" size="small" variant="contained">
            Sign in
          </Button>
        )}
      </Toolbar>
    </AppBar>
  );
}
