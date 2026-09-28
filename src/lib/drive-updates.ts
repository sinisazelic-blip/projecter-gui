import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * Polica za pakete: Google Disk folder FluxaUpdate.
 * Klijent ga ne vidi. Čita ga samo Fluxa, servisnim nalogom kome je folder podijeljen.
 *
 * Env:
 *   FLUXA_UPDATE_DRIVE_FOLDER_ID  — ID iz adrese drive.google.com/drive/folders/ID
 *   GOOGLE_SERVICE_ACCOUNT_FILE   — putanja do JSON ključa (nije u gitu)
 *   GOOGLE_SERVICE_ACCOUNT_JSON   — isti JSON kao tekst, ako fajl nije pri ruci
 */

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const PRODUCT_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
const FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/;

export type UpdateFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

type TokenCache = { access: string; expMs: number };

let tokenCache: TokenCache | null = null;

export function isProductName(value: string): boolean {
  return PRODUCT_RE.test(value);
}

export function isUpdateFileName(value: string): boolean {
  return FILE_RE.test(value) && !value.includes("..");
}

export function driveConfig(): {
  folderId: string;
  account: ServiceAccount;
} | null {
  const folderId = String(
    process.env.FLUXA_UPDATE_DRIVE_FOLDER_ID ?? "",
  ).trim();
  const account = readServiceAccount();
  if (!folderId || !account) return null;
  return { folderId, account };
}

function readServiceAccount(): ServiceAccount | null {
  const file = String(process.env.GOOGLE_SERVICE_ACCOUNT_FILE ?? "").trim();
  let raw = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "").trim();
  if (file) {
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      return null;
    }
  }
  if (!raw) return null;
  try {
    const json = raw.startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json) as Partial<ServiceAccount>;
    const email = String(parsed.client_email ?? "").trim();
    const key = String(parsed.private_key ?? "").trim();
    if (!email || !key) return null;
    return { client_email: email, private_key: key };
  } catch {
    return null;
  }
}

function b64url(value: string | Buffer): string {
  const buf = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buf.toString("base64url");
}

async function accessToken(account: ServiceAccount): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expMs - 60_000 > now) return tokenCache.access;

  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: DRIVE_SCOPE,
      aud: TOKEN_URL,
      iat,
      exp,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(account.private_key);
  const assertion = `${unsigned}.${b64url(signature)}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await res.json().catch(() => null)) as {
    access_token?: string;
  } | null;
  if (!res.ok || !payload?.access_token) {
    tokenCache = null;
    throw new Error("UPDATE_DRIVE_AUTH_FAILED");
  }
  tokenCache = { access: payload.access_token, expMs: exp * 1000 };
  return payload.access_token;
}

type DriveListItem = {
  id?: string;
  name?: string;
  size?: string;
  mimeType?: string;
};

async function driveList(
  access: string,
  parentId: string,
): Promise<DriveListItem[]> {
  const out: DriveListItem[] = [];
  let pageToken = "";
  for (let i = 0; i < 20; i++) {
    const q = `'${parentId.replace(/'/g, "")}' in parents and trashed = false`;
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", q);
    url.searchParams.set(
      "fields",
      "nextPageToken,files(id,name,size,mimeType)",
    );
    url.searchParams.set("pageSize", "200");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${access}` },
    });
    const payload = (await res.json().catch(() => null)) as {
      files?: DriveListItem[];
      nextPageToken?: string;
    } | null;
    if (!res.ok || !payload) throw new Error("UPDATE_DRIVE_LIST_FAILED");
    out.push(...(payload.files ?? []));
    pageToken = payload.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return out;
}

function asFile(item: DriveListItem): UpdateFile | null {
  const id = String(item.id ?? "").trim();
  const name = String(item.name ?? "").trim();
  if (!id || !name || !isUpdateFileName(name)) return null;
  if (item.mimeType === "application/vnd.google-apps.folder") return null;
  const size = Number(item.size ?? 0);
  return {
    id,
    name,
    size: Number.isFinite(size) ? size : 0,
    mimeType: String(item.mimeType ?? "application/octet-stream"),
  };
}

async function filesInFolder(
  access: string,
  folderId: string,
): Promise<UpdateFile[]> {
  const children = await driveList(access, folderId);
  const files = children
    .map(asFile)
    .filter((item): item is UpdateFile => item !== null);
  files.sort((a, b) => a.name.localeCompare(b.name));
  return files;
}

export async function listProducts(
  products: string[],
): Promise<Map<string, { folderFound: boolean; files: UpdateFile[] }>> {
  const cfg = driveConfig();
  if (!cfg) throw new Error("UPDATE_DRIVE_NOT_CONFIGURED");
  const wanted = products.filter(isProductName);
  const result = new Map<
    string,
    { folderFound: boolean; files: UpdateFile[] }
  >();
  for (const name of wanted)
    result.set(name, { folderFound: false, files: [] });
  if (wanted.length === 0) return result;

  const access = await accessToken(cfg.account);
  const rootItems = await driveList(access, cfg.folderId);
  await Promise.all(
    wanted.map(async (name) => {
      const folder = rootItems.find(
        (item) =>
          item.name === name &&
          item.mimeType === "application/vnd.google-apps.folder" &&
          item.id,
      );
      if (!folder?.id) return;
      const files = await filesInFolder(access, folder.id);
      result.set(name, { folderFound: true, files });
    }),
  );
  return result;
}

export async function listProduct(product: string): Promise<{
  folderFound: boolean;
  files: UpdateFile[];
}> {
  if (!isProductName(product)) throw new Error("UPDATE_PRODUCT_INVALID");
  const map = await listProducts([product]);
  return map.get(product) ?? { folderFound: false, files: [] };
}

export function semverOf(name: string): [number, number, number] | null {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(name);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareSemver(
  a: [number, number, number],
  b: [number, number, number],
): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  }
  return 0;
}

export function pickLatestZip(files: UpdateFile[]): UpdateFile | null {
  let best: UpdateFile | null = null;
  let bestVer: [number, number, number] | null = null;
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".zip")) continue;
    const ver = semverOf(file.name);
    if (!ver) continue;
    if (!best || !bestVer || compareSemver(ver, bestVer) > 0) {
      best = file;
      bestVer = ver;
    }
  }
  return best;
}

export async function openProductFile(
  product: string,
  name: string,
): Promise<{ file: UpdateFile; body: ReadableStream<Uint8Array> } | null> {
  const cfg = driveConfig();
  if (!cfg) throw new Error("UPDATE_DRIVE_NOT_CONFIGURED");
  const listed = await listProduct(product);
  const file = listed.files.find((item) => item.name === name);
  if (!file) return null;

  const access = await accessToken(cfg.account);
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!res.ok || !res.body) throw new Error("UPDATE_DRIVE_DOWNLOAD_FAILED");
  return { file, body: res.body };
}
