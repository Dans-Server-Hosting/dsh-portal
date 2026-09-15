// Plain module (no "use client") so both the server-rendered root layout and
// client components read the same value; importing a constant from a client
// module into a server component yields a client reference, not the string.

/** The mode a first-time visitor gets; the toggle in the header persists any change. */
export const DEFAULT_MODE = "dark" as const;
