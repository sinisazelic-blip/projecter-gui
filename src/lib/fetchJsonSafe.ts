/**
 * Fetch + sigurno parsiranje odgovora. Ako server vrati HTML (404/500),
 * umjesto SyntaxError vraća data: null i caller može provjeriti res.status.
 */
export async function fetchJsonSafe(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ res: Response; data: unknown }> {
  const res = await fetch(input, { cache: "no-store", ...init });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Server vratio ne-JSON (npr. HTML stranica greške)
  }
  return { res, data };
}
