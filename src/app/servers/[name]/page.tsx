import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Alert from "@mui/material/Alert";
import ServerDetail from "@/components/ServerDetail";
import { api, ApiError } from "@/lib/api";
import { requireSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  return { title: name };
}

export default async function ServerPage({ params }: Props) {
  const session = await requireSession();
  const { name } = await params;
  try {
    const server = await api.getServer(session.token, name);
    return <ServerDetail initial={server} />;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    const message = error instanceof ApiError ? error.message : "The hosting service is not reachable right now.";
    return <Alert severity="error">{message}</Alert>;
  }
}
