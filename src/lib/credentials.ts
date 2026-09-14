// UserAuth's registration rules, mirrored here so the form can hint at them
// before a request is made. UserAuth remains the authority: whatever it
// returns as a 400 message is shown verbatim.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 50;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export function usernameProblem(username: string): string | null {
  const length = username.trim().length;
  if (length < USERNAME_MIN || length > USERNAME_MAX) {
    return `Use ${USERNAME_MIN}-${USERNAME_MAX} characters.`;
  }
  return null;
}

export interface PasswordRule {
  label: string;
  ok: boolean;
}

export function passwordRules(password: string): PasswordRule[] {
  return [
    { label: `${PASSWORD_MIN}-${PASSWORD_MAX} characters`, ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX },
    { label: "a lowercase letter", ok: /[a-z]/.test(password) },
    { label: "an uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "a digit", ok: /[0-9]/.test(password) },
    { label: "a symbol", ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

export function passwordProblem(password: string): string | null {
  const failing = passwordRules(password).filter((r) => !r.ok);
  if (failing.length === 0) return null;
  return `The password needs ${failing.map((r) => r.label).join(", ")}.`;
}

/** The registration rules plus UserAuth's one extra rule for a change: it must differ. */
export function newPasswordRules(current: string, next: string): PasswordRule[] {
  return [...passwordRules(next), { label: "different from your current password", ok: next.length > 0 && next !== current }];
}

export function newPasswordProblem(current: string, next: string): string | null {
  const problem = passwordProblem(next);
  if (problem) return problem;
  if (next === current) return "The new password must be different from your current password.";
  return null;
}
