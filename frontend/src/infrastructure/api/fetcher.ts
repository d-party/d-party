import { API_BASE_URL } from "@/infrastructure/env";

/**
 * Backend base URL for a request.
 *
 * On the server (SSR metadata, OG image) reach the backend over the internal
 * container network via `BACKEND_INTERNAL_ORIGIN` (e.g. `http://django:8000`).
 * Hitting the public `API_BASE_URL` from inside the frontend container forces a
 * NAT-hairpin back through nginx, which can hang and block `generateMetadata`.
 * The browser always uses the public `API_BASE_URL`.
 */
function baseUrl(): string {
  if (typeof window === "undefined" && process.env.BACKEND_INTERNAL_ORIGIN) {
    return process.env.BACKEND_INTERNAL_ORIGIN.replace(/\/$/, "");
  }
  return API_BASE_URL;
}

/**
 * Custom fetch mutator used by the orval-generated REST client. Prefixes the
 * backend base URL and returns orval's `{ status, data, headers }` contract.
 *
 * Faithful port of the Chrome extension's `customFetch`
 * (chrome-extension/src/infrastructure/api/fetcher.ts).
 */
export const customFetch = async <T>(
  url: string,
  options?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${baseUrl()}${url}`, options);
  const body = await response.text();
  const data = body ? JSON.parse(body) : undefined;
  return { status: response.status, data, headers: response.headers } as T;
};
