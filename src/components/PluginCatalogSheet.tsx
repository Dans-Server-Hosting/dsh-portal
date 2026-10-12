"use client";
import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { explain, portalFetch } from "@/lib/client";
import { andList } from "@/lib/text";
import type { CatalogPlugin } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Kept by the parent so reopening the sheet does not fetch again. */
  catalog: CatalogPlugin[] | null;
  onCatalog: (catalog: CatalogPlugin[]) => void;
  installed: Set<string>;
  /** Resolves to the slugs that were added, or null when it failed (the parent shows why). */
  onInstall: (slug: string) => Promise<string[] | null>;
}

function matches(plugin: CatalogPlugin, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [plugin.title, plugin.description, ...plugin.tags].some((text) => text.toLowerCase().includes(q));
}

/**
 * The Dan's Plugins catalog, to install from. A bottom sheet on phones (no
 * hover anywhere: every action is a visible button) and a dialog on wider
 * screens. It stays open after an install, so several can be added in a row.
 */
export default function PluginCatalogSheet({ open, onClose, catalog, onCatalog, installed, onInstall }: Props) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("sm"));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [installing, setInstalling] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || catalog) return;
    let cancelled = false;
    setLoadError(null);
    portalFetch<CatalogPlugin[]>("/api/catalog")
      .then((plugins) => {
        if (!cancelled) onCatalog(plugins);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(explain(e, "plugins"));
      });
    return () => {
      cancelled = true;
    };
  }, [open, catalog, onCatalog, attempt]);

  const titleOf = (slug: string) => catalog?.find((p) => p.slug === slug)?.title ?? slug;

  async function install(plugin: CatalogPlugin) {
    setInstalling(plugin.slug);
    setNotice(null);
    const added = await onInstall(plugin.slug);
    setInstalling(null);
    if (added === null) {
      onClose();
      return;
    }
    const extra = added.filter((slug) => slug !== plugin.slug).map(titleOf);
    setNotice(`${plugin.title} added${extra.length ? `, with ${andList(extra)}` : ""}.`);
  }

  function close() {
    setNotice(null);
    setQuery("");
    onClose();
  }

  const shown = (catalog ?? []).filter((p) => matches(p, query));

  const body = (
    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
      <TextField
        size="small"
        fullWidth
        placeholder="Search plugins"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        inputProps={{ "aria-label": "Search plugins", "data-testid": "catalog-search", autoCapitalize: "none", autoCorrect: "off" }}
      />
      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)} data-testid="install-notice">
          {notice} It takes effect the next time the server starts.
        </Alert>
      )}
      {loadError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          }
        >
          {loadError}
        </Alert>
      )}
      {!catalog && !loadError && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} aria-label="Loading the catalog" />
        </Box>
      )}
      {catalog && shown.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Nothing matches “{query.trim()}”.
        </Typography>
      )}
      <Stack component="ul" spacing={1} sx={{ listStyle: "none", p: 0, m: 0 }} data-testid="catalog">
        {shown.map((plugin) => {
          const isInstalled = installed.has(plugin.slug);
          const alsoInstalls = plugin.requires.filter((slug) => !installed.has(slug)).map(titleOf);
          return (
            <Box
              component="li"
              key={plugin.slug}
              data-testid="catalog-plugin"
              data-slug={plugin.slug}
              sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", p: 1.25, borderRadius: 1, bgcolor: "action.hover", minWidth: 0 }}
            >
              <Avatar src={plugin.icon_url ?? undefined} alt="" variant="rounded" sx={{ width: 40, height: 40, flexShrink: 0 }}>
                {plugin.title.charAt(0)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                    {plugin.project_url ? (
                      <Link href={plugin.project_url} target="_blank" rel="noopener noreferrer" underline="hover" color="inherit">
                        {plugin.title}
                      </Link>
                    ) : (
                      plugin.title
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
                    {plugin.version}
                  </Typography>
                </Box>
                {plugin.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                    {plugin.description}
                  </Typography>
                )}
                {plugin.tags.length > 0 && (
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
                    {plugin.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                )}
                {!isInstalled && alsoInstalls.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }} data-testid="also-installs">
                    Also installs {andList(alsoInstalls)}
                  </Typography>
                )}
              </Box>
              <Button
                size="small"
                variant={isInstalled ? "text" : "contained"}
                disabled={isInstalled || installing !== null}
                onClick={() => install(plugin)}
                aria-label={isInstalled ? `${plugin.title} is installed` : `Install ${plugin.title}`}
                data-testid="install-plugin"
                sx={{ flexShrink: 0, minHeight: 36 }}
              >
                {isInstalled ? "Installed" : installing === plugin.slug ? "Adding…" : "Install"}
              </Button>
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );

  const title = (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
      <Typography variant="h6" component="h2" id="catalog-title">
        Add plugins
      </Typography>
      <IconButton aria-label="Close" onClick={close} edge="end" data-testid="catalog-close">
        <CloseIcon />
      </IconButton>
    </Box>
  );

  if (phone) {
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={close}
        slotProps={{
          paper: {
            "aria-labelledby": "catalog-title",
            role: "dialog",
            sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "88dvh" },
          } as object,
        }}
        data-testid="catalog-sheet"
      >
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }} aria-hidden>
          <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: "text.disabled" }} />
        </Box>
        <Box sx={{ px: 2, pt: 0.5 }}>{title}</Box>
        <Box sx={{ px: 2, pb: "calc(16px + env(safe-area-inset-bottom))", overflowY: "auto" }}>{body}</Box>
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm" scroll="paper" aria-labelledby="catalog-title" data-testid="catalog-sheet">
      <DialogTitle component="div">{title}</DialogTitle>
      <DialogContent dividers>{body}</DialogContent>
    </Dialog>
  );
}
