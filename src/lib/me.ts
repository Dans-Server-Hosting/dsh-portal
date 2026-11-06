import "server-only";
import { cache } from "react";
import { api, ApiError } from "./api";
import type { Me } from "./types";

const askMe = cache(async (token: string): Promise<{ me: Me | null; expired: boolean }> => {
  try {
    return { me: await api.me(token), expired: false };
  } catch (error) {
    console.error("me unavailable", error);
    return { me: null, expired: error instanceof ApiError && error.status === 401 };
  }
});

/**
 * Who the signed-in user is according to dsh-api, fetched once per request
 * (the header and the admin pages both ask). An unreachable API means "not
 * known", never "admin", so nothing admin-only is shown or served by mistake.
 */
export async function getMe(token: string): Promise<Me | null> {
  return (await askMe(token)).me;
}

/** Whether dsh-api refused the token itself, as opposed to not answering. */
export async function isSessionExpired(token: string): Promise<boolean> {
  return (await askMe(token)).expired;
}
