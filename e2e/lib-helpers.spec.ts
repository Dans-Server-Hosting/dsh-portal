import { expect, test } from "@playwright/test";
import { explain, formatWait, PortalError } from "../src/lib/client";
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

test("relativeTime moves up a unit when the count rounds to the next unit's size", () => {
  const now = Date.parse("2026-01-31T12:00:00Z");
  const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

  expect(relativeTime(ago(59 * 60 + 29), now)).toBe("59 minutes ago");
  expect(relativeTime(ago(59 * 60 + 30), now)).toBe("1 hour ago");
  expect(relativeTime(ago(23 * 3600 + 30 * 60), now)).toBe("1 day ago");
  expect(relativeTime(ago(6 * 86400 + 12 * 3600), now)).toBe("1 week ago");
  expect(relativeTime(ago(29 * 86400), now)).toBe("4 weeks ago");
  expect(relativeTime(ago(360 * 86400), now)).toBe("1 year ago");
  expect(relativeTime(ago(364 * 86400), now)).toBe("1 year ago");
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

test("formatWait rounds a wait up to minutes, then to hours from two hours on", () => {
  expect(formatWait(0)).toBe("under a minute");
  expect(formatWait(59)).toBe("under a minute");
  expect(formatWait(60)).toBe("1 minute");
  expect(formatWait(61)).toBe("2 minutes");
  expect(formatWait(119 * 60)).toBe("119 minutes");
  expect(formatWait(119 * 60 + 1)).toBe("2 hours");
  expect(formatWait(150 * 60)).toBe("3 hours");
});

test("explain words each status the way the page it came from needs", () => {
  const fail = (status: number, message = "detail from the API", server?: string) => new PortalError(status, message, server);

  expect(explain(fail(400, "Name is required."), "create")).toBe("Name is required.");

  expect(explain(fail(403), "create")).toBe("Your account is at its server limit. Delete a server before creating another.");
  expect(explain(fail(403), "password")).toBe("That is not your current password.");
  expect(explain(fail(403), "delete")).toBe("You do not have permission to do that.");

  expect(explain(fail(404, "No such user."), "password")).toBe("No such user.");
  expect(explain(fail(404), "feedback-status")).toBe("That feedback no longer exists.");
  expect(explain(fail(404), "wake")).toBe("That server no longer exists.");

  expect(explain(fail(409, "pending", "survival"), "create")).toBe("A server is already being created for your account.");
  expect(explain(fail(409), "create")).toBe("That name is already taken. Pick another.");
  expect(explain(fail(409), "delete")).toBe("Players are online right now. Tick the box to delete anyway.");
  expect(explain(fail(409, "Server is waking."), "wake")).toBe("Server is waking.");

  expect(explain(fail(422, "Too weak."), "password")).toBe("Too weak.");
  expect(explain(fail(422, "too long"), "feedback")).toBe("That could not be sent: too long");
  expect(explain(fail(422, "reserved"), "create")).toBe("That name is not allowed: reserved");

  expect(explain(fail(429), "feedback")).toBe("You have sent a lot of feedback in the last hour. Thank you; please try again later.");
  expect(explain(fail(429, "Slow down."), "wake")).toBe("Slow down.");

  // A 502 carries a sentence written to be shown, so it passes through.
  expect(explain(fail(502, "The cluster could not be reached."), "load")).toBe("The cluster could not be reached.");
  // Anything that is not a PortalError gets the generic line.
  expect(explain(new Error("boom"), "load")).toBe("Something went wrong. Try again in a moment.");
});

test("explain turns plugin and export answers into a capitalised sentence", () => {
  expect(explain(new PortalError(409, "server is busy"), "plugins")).toBe("Server is busy.");
  expect(explain(new PortalError(503, "Catalog is down."), "plugins")).toBe("Catalog is down.");

  expect(explain(new PortalError(429, "limit", undefined, undefined, 3 * 3600), "export")).toBe(
    "Your account has used its exports for today. Try again in 3 hours.",
  );
  expect(explain(new PortalError(429, "limit"), "export")).toBe("Your account has used its exports for today. Try again later.");
  expect(explain(new PortalError(404, "gone"), "export")).toBe("That export no longer exists.");
  expect(explain(new PortalError(422, "area too large"), "export")).toBe("That area cannot be exported: Area too large.");
  expect(explain(new PortalError(409, "another export is running"), "export")).toBe("Another export is running.");

  // A 401 is not reworded here: portalFetch has already sent the user to sign in.
  expect(explain(new PortalError(401, "Your session has expired; signing you in again."), "plugins")).toBe(
    "Your session has expired; signing you in again.",
  );
});
