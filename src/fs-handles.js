const DB_NAME = 'bpt-hero-animation';
const STORE = 'handles';
const SAVES_KEY = 'savesDir';
const EXPORTS_KEY = 'exportsDir';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function getHandle(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result ?? null);
  });
}

async function putHandle(key, handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(handle, key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function getStoredSavesDirHandle() {
  if (!('showDirectoryPicker' in window)) return null;
  try {
    return await getHandle(SAVES_KEY);
  } catch {
    return null;
  }
}

export async function storeSavesDirHandle(handle) {
  await putHandle(SAVES_KEY, handle);
}

async function ensurePermission(handle, mode) {
  const current = await handle.queryPermission({ mode });
  if (current === 'granted') return true;
  const requested = await handle.requestPermission({ mode });
  return requested === 'granted';
}

export async function getStoredExportsDirHandle() {
  if (!('showDirectoryPicker' in window)) return null;
  try {
    return await getHandle(EXPORTS_KEY);
  } catch {
    return null;
  }
}

export async function storeExportsDirHandle(handle) {
  await putHandle(EXPORTS_KEY, handle);
}

export async function ensureExportsDirHandle() {
  if (!('showDirectoryPicker' in window)) return null;

  let handle = await getStoredExportsDirHandle();
  if (handle && (await ensurePermission(handle, 'readwrite'))) {
    return handle;
  }

  handle = await window.showDirectoryPicker({
    id: 'bpt-hero-exports',
    mode: 'readwrite',
    startIn: 'documents'
  });
  await storeExportsDirHandle(handle);
  await ensurePermission(handle, 'readwrite');
  return handle;
}

export async function writeFileToDirectoryHandle(dirHandle, filename, blob) {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/** Prompt once (or reuse stored handle) so Open can start in the saves folder. */
export async function ensureSavesDirHandle() {
  if (!('showDirectoryPicker' in window)) return null;

  let handle = await getStoredSavesDirHandle();
  if (handle && (await ensurePermission(handle, 'read'))) {
    return handle;
  }

  handle = await window.showDirectoryPicker({
    id: 'bpt-hero-saves',
    mode: 'readwrite',
    startIn: 'documents'
  });
  await storeSavesDirHandle(handle);
  await ensurePermission(handle, 'readwrite');
  return handle;
}
