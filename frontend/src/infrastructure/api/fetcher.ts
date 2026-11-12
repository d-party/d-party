import { API_BASE_URL } from "@/infrastructure/env";

/**
 * On the server, use `BACKEND_INTERNAL_ORIGIN` (e.g. `http://django:8000`). The
 * public URL would hairpin through nginx and can hang `generateMetadata`.
 */
function baseUrl(): string {
  if (typeof window === "undefined" && process.env.BACKEND_INTERNAL_ORIGIN) {
    return process.env.BACKEND_INTERNAL_ORIGIN.replace(/\/$/, "");
  }
  return API_BASE_URL;
}

/** orval mutator: prefixes the base URL and returns `{ status, data, headers }`. */
export const customFetch = async <T>(
  url: string,
  options?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${baseUrl()}${url}`, options);
  const body = await response.text();
  // Proxy errors (502 / 504) are often HTML; keep the status instead of throwing.

  let data: unknown = undefined;
  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      data = undefined;
    }
  }
  return { status: response.status, data, headers: response.headers } as T;
};
