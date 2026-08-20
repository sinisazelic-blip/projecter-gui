/**
 * Spremanje PDF-a u odabrani folder (File System Access API + IndexedDB).
 * Chrome/Edge: prvi put biraš folder; sljedeći put snima tamo bez Downloads.
 * Fallback: klasični download ako API nije dostupan.
 */

const DB_NAME = "fluxa-pdf-save";
const STORE = "handles";
const DIR_KEY = "invoicePdfDir";

type DirHandle = {
  queryPermission?: (opts: { mode: "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: "readwrite" }) => Promise<PermissionState>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

async function idbGet(key: string): Promise<DirHandle | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as DirHandle) || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: DirHandle): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function ensureRwPermission(handle: DirHandle): Promise<boolean> {
  const opts = { mode: "readwrite" as const };
  if (typeof handle.queryPermission === "function") {
    const q = await handle.queryPermission(opts);
    if (q === "granted") return true;
  }
  if (typeof handle.requestPermission === "function") {
    const r = await handle.requestPermission(opts);
    return r === "granted";
  }
  return true;
}

function getWin(): any {
  return typeof window !== "undefined" ? window : null;
}

function supportsDirPicker(): boolean {
  const w = getWin();
  return !!w && typeof w.showDirectoryPicker === "function";
}

async function pickAndStoreDirectory(): Promise<DirHandle | null> {
  const w = getWin();
  if (!w?.showDirectoryPicker) return null;
  const handle = (await w.showDirectoryPicker({
    id: "fluxa-invoice-pdfs",
    mode: "readwrite",
    startIn: "documents",
  })) as DirHandle;
  await idbSet(DIR_KEY, handle);
  return handle;
}

/** Briše zapamćeni folder (npr. ako korisnik želi novu lokaciju). */
export async function clearPreferredPdfDirectory(): Promise<void> {
  try {
    await idbDel(DIR_KEY);
  } catch {
    /* ignore */
  }
}

/** Samo izbor i pamćenje foldera (bez snimanja fajla). */
export async function pickPreferredPdfDirectory(): Promise<boolean> {
  const dir = await pickAndStoreDirectory();
  return !!dir;
}

/**
 * Snima PDF blob u zapamćeni folder, ili pita za folder / save dialog.
 * @returns "dir" | "picker" | "download"
 */
export async function savePdfBlobPreferred(
  blob: Blob,
  filename: string,
  opts?: { forcePickFolder?: boolean },
): Promise<"dir" | "picker" | "download"> {
  const safeName = String(filename || "faktura.pdf").replace(/[/\\?%*:|"<>]/g, "_");
  const name = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;

  if (supportsDirPicker()) {
    try {
      let dir: DirHandle | null = null;
      if (!opts?.forcePickFolder) {
        dir = await idbGet(DIR_KEY);
        if (dir && !(await ensureRwPermission(dir))) {
          await idbDel(DIR_KEY);
          dir = null;
        }
      }
      if (!dir) {
        dir = await pickAndStoreDirectory();
      }
      if (dir) {
        const fileHandle = await dir.getFileHandle(name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return "dir";
      }
    } catch (e: unknown) {
      const nameErr = e instanceof Error ? e.name : "";
      if (nameErr === "AbortError") throw e;
    }
  }

  const w = getWin();
  if (w && typeof w.showSaveFilePicker === "function") {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: name,
        types: [
          {
            description: "PDF",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "picker";
    } catch (e: unknown) {
      const nameErr = e instanceof Error ? e.name : "";
      if (nameErr === "AbortError") throw e;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "download";
}
