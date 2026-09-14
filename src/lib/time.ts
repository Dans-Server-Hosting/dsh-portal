const UNITS: Array<[name: string, seconds: number]> = [
  ["minute", 60],
  ["hour", 60 * 60],
  ["day", 60 * 60 * 24],
  ["week", 60 * 60 * 24 * 7],
  ["month", 60 * 60 * 24 * 30],
  ["year", 60 * 60 * 24 * 365],
];

/** "3 minutes ago" style, for lists where the exact timestamp is a tooltip. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return "just now";
  let [name, unitSeconds] = UNITS[0];
  for (const unit of UNITS) {
    if (seconds >= unit[1]) [name, unitSeconds] = unit;
  }
  const count = Math.max(1, Math.round(seconds / unitSeconds));
  return `${count} ${name}${count === 1 ? "" : "s"} ago`;
}
