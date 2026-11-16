// Each unit names the count at which it reads as one of the next unit up, so
// 59.5 minutes rounds to "1 hour" rather than "60 minutes". A week never
// rounds past 4 before a month takes over at 30 days, so it needs none.
const UNITS: Array<[name: string, seconds: number, rollover?: number]> = [
  ["minute", 60, 60],
  ["hour", 60 * 60, 24],
  ["day", 60 * 60 * 24, 7],
  ["week", 60 * 60 * 24 * 7],
  ["month", 60 * 60 * 24 * 30, 12],
  ["year", 60 * 60 * 24 * 365],
];

/** "3 minutes ago" style, for lists where the exact timestamp is a tooltip. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return "just now";
  let index = 0;
  UNITS.forEach((unit, i) => {
    if (seconds >= unit[1]) index = i;
  });
  let count = Math.max(1, Math.round(seconds / UNITS[index][1]));
  const rollover = UNITS[index][2];
  if (rollover !== undefined && count >= rollover) {
    index += 1;
    count = Math.max(1, Math.round(seconds / UNITS[index][1]));
  }
  const name = UNITS[index][0];
  return `${count} ${name}${count === 1 ? "" : "s"} ago`;
}
