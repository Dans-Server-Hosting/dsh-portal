import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site";
import { redirect } from "next/navigation";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LoginForm } from "@/components/AuthForms";
import { getSession } from "@/lib/session";

export const metadata: Metadata = publicPageMetadata("/auth/login", "Sign in", "Sign in to Dan's Server Hosting to create, wake and manage your free Minecraft server.");
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ registered?: string }> }) {
  if (await getSession()) redirect("/servers");
  const params = await searchParams;
  return (
    <Stack spacing={2} sx={{ maxWidth: 420 }}>
      <Typography variant="h1" component="h1">
        Sign in
      </Typography>
      {params.registered && <Alert severity="success">Your account was created. Sign in to continue.</Alert>}
      <LoginForm />
    </Stack>
  );
}
