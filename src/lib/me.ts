import "server-only";
import { cache } from "react";
import { api } from "./api";
import type { Me } from "./types";

/**
 * Who the signed-in user is according to dsh-api, fetched once per request
 * (the header and the admin pages both ask). An unreachable API means "not
 * known", never "admin", so nothing admin-only is shown or served by mistake.
 */
export const getMe = cache(async (token: string): Promise<Me | null> => {
  try {
    return await api.me(token);
  } catch (error) {
    console.error("me unavailable", error);
    return null;
  }
});
