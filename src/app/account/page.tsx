import type { Metadata } from "next";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireSession();
  return (
    <Stack spacing={3} sx={{ maxWidth: 420 }}>
      <Box>
        <Typography variant="h1" component="h1" gutterBottom>
          Account
        </Typography>
        {session.username && (
          <Typography color="text.secondary">
            Signed in as <strong data-testid="account-username">{session.username}</strong>.
          </Typography>
        )}
      </Box>
      <Box>
        <Typography variant="h3" component="h2" gutterBottom>
          Change password
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Changing it signs you out everywhere else; this browser stays signed in.
        </Typography>
        <ChangePasswordForm />
      </Box>
    </Stack>
  );
}
