import { API_BASE_URL } from "@/infrastructure/env";

/** orval mutator: prefixes the base URL and returns `{ status, data, headers }`. */
export const customFetch = async <T>(
  url: string,
  options?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${url}`, options);
  const body = await response.text();
  return {
    status: response.status,
    data: parseJson(body),
    headers: response.headers,
  } as T;
};

/** Proxy errors (502 / 504) are often HTML; keep the status instead of throwing. */
function parseJson(body: string): unknown {
  if (!body) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}
