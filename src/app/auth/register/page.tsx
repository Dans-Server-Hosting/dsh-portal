import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/site";
import { redirect } from "next/navigation";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { RegisterForm } from "@/components/AuthForms";
import { getSession } from "@/lib/session";

export const metadata: Metadata = publicPageMetadata("/auth/register", "Create an account", "Create a free Dan's Server Hosting account and get a Minecraft server for you and your friends.");
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getSession()) redirect("/servers");
  return (
    <Stack spacing={2} sx={{ maxWidth: 420 }}>
      <Typography variant="h1" component="h1">
        Create an account
      </Typography>
      <Typography color="text.secondary">One account is all it takes; the server comes next.</Typography>
      <RegisterForm />
    </Stack>
  );
}
