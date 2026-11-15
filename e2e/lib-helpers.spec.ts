import { expect, test } from "@playwright/test";
import {
  newPasswordProblem,
  newPasswordRules,
  passwordProblem,
  passwordRules,
  usernameProblem,
} from "../src/lib/credentials";
import { andList, plural } from "../src/lib/text";
import { relativeTime } from "../src/lib/time";

// The wording and rule helpers behind the pages, checked directly. They need
// no browser, so they run once rather than at both viewports.
test.skip(({ isMobile }) => isMobile, "no page involved; the desktop run is enough");

test("andList joins names the way the plugin notices read", () => {
  expect(andList([])).toBe("");
  expect(andList(["Fiefs"])).toBe("Fiefs");
  expect(andList(["Fiefs", "Currencies"])).toBe("Fiefs and Currencies");
  expect(andList(["Fiefs", "Currencies", "Medieval Factions"])).toBe("Fiefs, Currencies and Medieval Factions");
});

test("plural adds an s for every count but one", () => {
  expect(plural(1, "server")).toBe("1 server");
  expect(plural(0, "server")).toBe("0 servers");
  expect(plural(2, "day")).toBe("2 days");
});

test("relativeTime words how long ago something happened", () => {
  const now = Date.parse("2026-01-31T12:00:00Z");
  const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

  expect(relativeTime(ago(0), now)).toBe("just now");
  expect(relativeTime(ago(44), now)).toBe("just now");
  expect(relativeTime(ago(45), now)).toBe("1 minute ago");
  expect(relativeTime(ago(3 * 60), now)).toBe("3 minutes ago");
  expect(relativeTime(ago(60 * 60), now)).toBe("1 hour ago");
  expect(relativeTime(ago(90 * 60), now)).toBe("2 hours ago");
  expect(relativeTime(ago(2 * 86400), now)).toBe("2 days ago");
  expect(relativeTime(ago(14 * 86400), now)).toBe("2 weeks ago");
  expect(relativeTime(ago(60 * 86400), now)).toBe("2 months ago");
  expect(relativeTime(ago(400 * 86400), now)).toBe("1 year ago");
});

test("relativeTime calls a time in the future just now and passes an unreadable one through", () => {
  const now = Date.parse("2026-01-31T12:00:00Z");
  expect(relativeTime("2026-01-31T13:00:00Z", now)).toBe("just now");
  expect(relativeTime("not a date", now)).toBe("not a date");
});

test("usernameProblem holds a trimmed username to 3-50 characters", () => {
  expect(usernameProblem("ab")).toBe("Use 3-50 characters.");
  expect(usernameProblem("  ab  ")).toBe("Use 3-50 characters.");
  expect(usernameProblem("abc")).toBeNull();
  expect(usernameProblem("a".repeat(50))).toBeNull();
  expect(usernameProblem("a".repeat(51))).toBe("Use 3-50 characters.");
});

test("passwordRules mirrors UserAuth's policy, one rule at a time", () => {
  const failing = (password: string) => passwordRules(password).filter((rule) => !rule.ok).map((rule) => rule.label);

  expect(failing("Sup3r$ecret!")).toEqual([]);
  expect(failing("")).toEqual(["8-72 characters", "a lowercase letter", "an uppercase letter", "a digit", "a symbol"]);
  expect(failing("Sh0rt!")).toEqual(["8-72 characters"]);
  expect(failing(`Aa1!${"a".repeat(68)}`)).toEqual([]);
  expect(failing(`Aa1!${"a".repeat(69)}`)).toEqual(["8-72 characters"]);
  expect(failing("SUPER$ECRET1")).toEqual(["a lowercase letter"]);
  expect(failing("super$ecret1")).toEqual(["an uppercase letter"]);
  expect(failing("Super$ecret!")).toEqual(["a digit"]);
  expect(failing("Sup3rSecret1")).toEqual(["a symbol"]);
  // Anything that is not a letter or a digit counts as a symbol, a space included.
  expect(failing("Sup3r Secret")).toEqual([]);
});

test("passwordProblem names every rule still failing, or nothing", () => {
  expect(passwordProblem("Sup3r$ecret!")).toBeNull();
  expect(passwordProblem("short")).toBe("The password needs 8-72 characters, an uppercase letter, a digit, a symbol.");
});

test("a new password must also differ from the current one", () => {
  const different = (current: string, next: string) => newPasswordRules(current, next).at(-1);

  expect(newPasswordRules("Old$ecret1", "New$ecret1")).toHaveLength(6);
  expect(different("Old$ecret1", "New$ecret1")).toEqual({ label: "different from your current password", ok: true });
  expect(different("Old$ecret1", "Old$ecret1")?.ok).toBe(false);
  // An empty new password is not counted as different, so the rule is not ticked before anything is typed.
  expect(different("", "")?.ok).toBe(false);

  expect(newPasswordProblem("Old$ecret1", "New$ecret1")).toBeNull();
  expect(newPasswordProblem("Old$ecret1", "Old$ecret1")).toBe("The new password must be different from your current password.");
  // The policy is reported first, even when the new password is also the current one.
  expect(newPasswordProblem("weak", "weak")).toBe("The password needs 8-72 characters, an uppercase letter, a digit, a symbol.");
});
