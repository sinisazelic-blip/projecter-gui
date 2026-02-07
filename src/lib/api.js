// src/lib/api.js

function getBaseUrl() {
  // 1) ručno zadato (preporuka za prod)
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.APP_URL) return process.env.APP_URL;

  // 2) Vercel/hosted env (ako ikad deploy-aš)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // 3) lokalno
  return "http://localhost:3000";
}

export async function apiGet(path, options = {}) {
  const baseUrl = getBaseUrl();
  const url = path.startsWith("http") ? path : new URL(path, baseUrl).toString();

  const res = await fetch(url, {
    cache: options.cache ?? "no-store",
    ...options,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && (data.message || data.error)) ||
      `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
