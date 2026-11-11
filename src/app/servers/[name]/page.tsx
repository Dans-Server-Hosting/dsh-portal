import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Alert from "@mui/material/Alert";
import ServerDetail from "@/components/ServerDetail";
import SessionExpired from "@/components/SessionExpired";
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
    // The plugin lists are decoration: the page must not fail because they
    // did. The selection answers 503 while dsh-api has plugin selection
    // switched off, and the page then shows the default plugins instead.
    // World exports likewise answer 503 while world export is switched off
    // (RFC 0021); the section is then not shown at all.
    // The world thumbnail (RFC 0034) answers 503 while switched off (no
    // section) and 404 while there is no picture yet (a section offering one).
    const [server, defaults, selection, exports, limits, thumbnail] = await Promise.all([
      api.getServer(session.token, name),
      api.defaultPlugins().catch(() => []),
      api.serverPlugins(session.token, name).catch(() => null),
      api.listExports(session.token, name).then((r) => r.exports).catch(() => null),
      api.limits().catch(() => null),
      api
        .getThumbnail(session.token, name)
        .then((view) => ({ view }))
        .catch((error) => (error instanceof ApiError && error.status === 404 ? { view: null } : null)),
    ]);
    return (
      <ServerDetail
        initial={server}
        defaultPlugins={defaults}
        plugins={selection}
        exports={exports}
        limits={limits}
        thumbnail={thumbnail}
      />
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    if (error instanceof ApiError && error.status === 401) return <SessionExpired />;
    const message = error instanceof ApiError ? error.message : "The hosting service is not reachable right now.";
    return <Alert severity="error">{message}</Alert>;
  }
}
