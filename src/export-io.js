import {
  ensureExportsDirHandle,
  getStoredExportsDirHandle,
  writeFileToDirectoryHandle
} from './fs-handles.js';

let exportsApiAvailable;

export async function isExportsApiAvailable() {
  if (exportsApiAvailable !== undefined) return exportsApiAvailable;
  try {
    const res = await fetch('/api/saves', { method: 'GET' });
    exportsApiAvailable = res.ok;
  } catch {
    exportsApiAvailable = false;
  }
  return exportsApiAvailable;
}

export function defaultExportBasename(stem, format) {
  const safe = String(stem || 'untitled')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .trim() || 'untitled';
  const ext = format === 'mp4' ? 'mp4' : 'webm';
  return `${safe}.${ext}`;
}

export function sanitizeExportFilename(name, format) {
  let base = String(name ?? '').trim().replace(/^.*[/\\]/, '');
  if (!base) return null;
  const ext = format === 'mp4' ? '.mp4' : '.webm';
  if (!base.toLowerCase().endsWith(ext)) {
    base = base.replace(/\.(mp4|webm)$/i, '');
    base = `${base}${ext}`;
  }
  if (base.includes('..')) return null;
  return base;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function writeExport({ blob, filename, useCustomFolder }) {
  if (!useCustomFolder && (await isExportsApiAvailable())) {
    const res = await fetch('/api/exports', {
      method: 'POST',
      headers: { 'X-Filename': filename },
      body: blob
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, via: 'exports', path: data.path || `exports/${filename}` };
    }
  }

  const handle = useCustomFolder ? await getStoredExportsDirHandle() : null;
  if (handle) {
    try {
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted' || (await handle.requestPermission({ mode: 'readwrite' })) === 'granted') {
        await writeFileToDirectoryHandle(handle, filename, blob);
        return { ok: true, via: 'folder', path: filename };
      }
    } catch (err) {
      console.warn(err);
    }
  }

  if (window.showSaveFilePicker) {
    try {
      const pickerHandle = await window.showSaveFilePicker({
        suggestedName: filename,
        startIn: handle ?? undefined,
        types: [
          {
            description: 'Video',
            accept: {
              'video/mp4': ['.mp4'],
              'video/webm': ['.webm']
            }
          }
        ]
      });
      const writable = await pickerHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true, via: 'picker', path: pickerHandle.name };
    } catch (err) {
      if (err?.name === 'AbortError') {
        return { ok: false, cancelled: true };
      }
    }
  }

  downloadBlob(blob, filename);
  return { ok: true, via: 'download', path: filename };
}

export async function chooseExportFolder() {
  const handle = await ensureExportsDirHandle();
  return Boolean(handle);
}

export function getExportFolderLabel(useCustomFolder, apiAvailable) {
  if (useCustomFolder) return 'Custom folder';
  if (apiAvailable) return 'exports/';
  return 'Downloads';
}
