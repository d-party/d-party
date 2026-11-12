import { API_BASE_URL } from "@/infrastructure/env";

/** orval mutator: prefixes the base URL and returns `{ status, data, headers }`. */
export const customFetch = async <T>(
  url: string,
  options?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${url}`, options);
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
