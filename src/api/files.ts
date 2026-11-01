/**
 * Uploaded files in demo mode.
 *
 * SVGA animations are often several MB, too big for localStorage, so demo uploads
 * go to this browser's IndexedDB and are referenced as "idb:<id>". With the
 * backend, uploads go to `POST /admin/uploads` and the ref is the file's URL.
 */
import { AdminError } from "./errors";
import type { FileRef } from "./types";

const DB_NAME = "panchayat-admin-files";
const STORE = "files";

export const MAX_SVGA_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Checks type and size before any upload. Throws an AdminError with a readable message. */
export function checkUpload(file: File, kind: "svga" | "image") {
  const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;
  if (kind === "svga") {
    if (!file.name.toLowerCase().endsWith(".svga")) throw new AdminError("Pick an .svga file");
    if (file.size > MAX_SVGA_BYTES) throw new AdminError(`SVGA files can be up to ${mb(MAX_SVGA_BYTES)}. This one is ${mb(file.size)}.`);
  } else {
    if (!IMAGE_TYPES.includes(file.type)) throw new AdminError("Pick a PNG, JPG, WebP or GIF image");
    if (file.size > MAX_IMAGE_BYTES) throw new AdminError(`Images can be up to ${mb(MAX_IMAGE_BYTES)}`);
  }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

export async function saveLocalFile(file: Blob): Promise<FileRef> {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  try {
    await tx("readwrite", (s) => s.put(file, id));
  } catch {
    throw new AdminError("Couldn't save the file. Browser storage is full or blocked.");
  }
  return `idb:${id}`;
}

export async function deleteLocalFile(ref?: FileRef) {
  if (!ref?.startsWith("idb:")) return;
  await tx("readwrite", (s) => s.delete(ref.slice(4))).catch(() => undefined);
}

export async function clearLocalFiles() {
  await tx("readwrite", (s) => s.clear()).catch(() => undefined);
}

/** A URL the browser can load for any file ref. Object URLs are cached for the page's life. */
const urls = new Map<string, Promise<string | null>>();
export function fileUrl(ref: FileRef): Promise<string | null> {
  if (!ref.startsWith("idb:")) return Promise.resolve(ref);
  let u = urls.get(ref);
  if (!u) {
    u = tx<Blob | undefined>("readonly", (s) => s.get(ref.slice(4)))
      .then((b) => (b ? URL.createObjectURL(b) : null))
      .catch(() => null);
    urls.set(ref, u);
  }
  return u;
}
