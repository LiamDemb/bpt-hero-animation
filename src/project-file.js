import { ensureSavesDirHandle, getStoredSavesDirHandle } from './fs-handles.js';
import {
  exportStem,
  getSaveFilename,
  sanitizeSaveFilename
} from './project-session.js';
import { mergeSettings } from './settings.js';

const FORMAT = 'bpt-hero-settings';
const VERSION = 1;

export function serializeProject(settings) {
  return {
    format: FORMAT,
    version: VERSION,
    settings
  };
}

export function parseProjectFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Invalid project file' };
  }
  if (!data || data.format !== FORMAT || typeof data.settings !== 'object') {
    return { ok: false, error: 'Invalid project file' };
  }
  return { ok: true, settings: mergeSettings(data.settings) };
}

let savesApiAvailable;

export async function isSavesApiAvailable() {
  if (savesApiAvailable !== undefined) return savesApiAvailable;
  try {
    const res = await fetch('/api/saves', { method: 'GET' });
    savesApiAvailable = res.ok;
  } catch {
    savesApiAvailable = false;
  }
  return savesApiAvailable;
}

export async function listSaveFiles() {
  if (!(await isSavesApiAvailable())) return [];
  const res = await fetch('/api/saves');
  if (!res.ok) return [];
  const data = await res.json();
  return data.files ?? [];
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function formatRelativeTime(mtimeMs) {
  const diff = Date.now() - mtimeMs;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function confirmOverwrite(filename) {
  return window.confirm(`“${filename}” already exists. Replace it?`);
}

function promptSaveFilename({ title, defaultStem, existingFiles }) {
  const existing = new Set((existingFiles ?? []).map(f => f.filename ?? f));
  const defaultName = defaultStem ? `${defaultStem}.json` : 'untitled.json';

  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'saves-picker';
    dialog.innerHTML = `
      <form method="dialog" class="saves-picker__form">
        <h2 class="saves-picker__title">${escapeHtml(title)}</h2>
        <label class="saves-picker__label">
          File name
          <input class="saves-picker__text" type="text" name="filename" value="${escapeAttr(defaultName.replace(/\.json$/i, ''))}" required autocomplete="off" />
        </label>
        <p class="saves-picker__hint">Saved to <code>saves/</code></p>
        <div class="saves-picker__actions">
          <button type="button" class="saves-picker__cancel">Cancel</button>
          <button type="submit" class="saves-picker__open">Save</button>
        </div>
      </form>
    `;

    const form = dialog.querySelector('form');
    const input = dialog.querySelector('input');
    const cancelBtn = dialog.querySelector('.saves-picker__cancel');

    cancelBtn.addEventListener('click', () => dialog.close(null));

    form.addEventListener('submit', e => {
      e.preventDefault();
      const filename = sanitizeSaveFilename(input.value);
      if (!filename) {
        input.focus();
        return;
      }
      if (existing.has(filename) && !confirmOverwrite(filename)) {
        return;
      }
      dialog.close(filename);
    });

    dialog.addEventListener('close', () => {
      const value = dialog.returnValue;
      dialog.remove();
      resolve(value || null);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    input.select();
  });
}

export function promptRenameFilename(currentFilename, existingFiles) {
  const stem = currentFilename.replace(/\.json$/i, '');
  const existing = new Set((existingFiles ?? []).map(f => f.filename ?? f));
  existing.delete(currentFilename);

  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'saves-picker';
    dialog.innerHTML = `
      <form method="dialog" class="saves-picker__form">
        <h2 class="saves-picker__title">Rename project</h2>
        <label class="saves-picker__label">
          New file name
          <input class="saves-picker__text" type="text" name="filename" value="${escapeAttr(stem)}" required autocomplete="off" />
        </label>
        <p class="saves-picker__hint">Renames <code>saves/${escapeHtml(currentFilename)}</code></p>
        <div class="saves-picker__actions">
          <button type="button" class="saves-picker__cancel">Cancel</button>
          <button type="submit" class="saves-picker__open">Rename</button>
        </div>
      </form>
    `;

    const form = dialog.querySelector('form');
    const input = dialog.querySelector('input');
    const cancelBtn = dialog.querySelector('.saves-picker__cancel');

    cancelBtn.addEventListener('click', () => dialog.close(null));

    form.addEventListener('submit', e => {
      e.preventDefault();
      const filename = sanitizeSaveFilename(input.value);
      if (!filename) {
        input.focus();
        return;
      }
      if (filename === currentFilename) {
        dialog.close(null);
        return;
      }
      if (existing.has(filename) && !confirmOverwrite(filename)) {
        return;
      }
      dialog.close(filename);
    });

    dialog.addEventListener('close', () => {
      const value = dialog.returnValue;
      dialog.remove();
      resolve(value && value !== currentFilename ? value : null);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    input.select();
  });
}

async function postSave(filename, content, overwrite) {
  const res = await fetch('/api/saves', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, content, overwrite })
  });
  if (res.status === 409) {
    return { ok: false, exists: true };
  }
  if (!res.ok) {
    return { ok: false, error: 'Save failed' };
  }
  const data = await res.json();
  return { ok: true, filename: data.filename || filename, via: 'saves' };
}

export function downloadProject(settings, filename) {
  const blob = new Blob([JSON.stringify(serializeProject(settings), null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function saveToApi(settings, filename, overwrite = true) {
  const content = JSON.stringify(serializeProject(settings), null, 2);
  let result = await postSave(filename, content, overwrite);
  if (result.exists && !overwrite) {
    if (!confirmOverwrite(filename)) {
      return { ok: false, cancelled: true };
    }
    result = await postSave(filename, content, true);
  }
  return result;
}

export async function saveProjectDocument(settings, { mode = 'save' } = {}) {
  const bound = getSaveFilename();
  const files = await listSaveFiles();

  if (mode === 'save' && bound) {
    if (await isSavesApiAvailable()) {
      const result = await saveToApi(settings, bound, true);
      if (result.ok) return result;
      if (result.cancelled) return { ok: false, cancelled: true };
    }
    downloadProject(settings, bound);
    return { ok: true, via: 'download', filename: bound };
  }

  const defaultStem = mode === 'saveAs' && bound ? bound.replace(/\.json$/i, '') : exportStem();
  const filename = await promptSaveFilename({
    title: mode === 'saveAs' ? 'Save project as' : 'Save project',
    defaultStem: defaultStem === 'untitled' ? 'untitled' : defaultStem,
    existingFiles: files
  });
  if (!filename) return { ok: false, cancelled: true };

  if (await isSavesApiAvailable()) {
    const result = await saveToApi(settings, filename, true);
    if (result.ok) return result;
    if (result.cancelled) return { ok: false, cancelled: true };
  }

  downloadProject(settings, filename);
  return { ok: true, via: 'download', filename };
}

export async function renameProjectFile(from, to) {
  const target = sanitizeSaveFilename(to);
  if (!target || target === from) return { ok: false, cancelled: true };

  if (await isSavesApiAvailable()) {
    let res = await fetch('/api/saves/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: target, overwrite: false })
    });
    if (res.status === 409) {
      if (!confirmOverwrite(target)) {
        return { ok: false, cancelled: true };
      }
      res = await fetch('/api/saves/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: target, overwrite: true })
      });
    }
    if (!res.ok) return { ok: false, error: 'Rename failed' };
    const data = await res.json();
    return { ok: true, filename: data.filename || target };
  }

  return { ok: false, error: 'Rename requires dev server' };
}

async function pickProjectFromSavesList() {
  const files = await listSaveFiles();

  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'saves-picker';
    const hasFiles = files.length > 0;
    dialog.innerHTML = `
      <form method="dialog" class="saves-picker__form">
        <h2 class="saves-picker__title">Open project</h2>
        ${
          hasFiles
            ? `
        <label class="saves-picker__label">
          Project file
          <select class="saves-picker__select" name="file" required>
            ${files
              .map(
                f =>
                  `<option value="${escapeAttr(f.filename)}">${escapeHtml(f.filename)} · ${formatRelativeTime(f.mtimeMs)}</option>`
              )
              .join('')}
          </select>
        </label>`
            : `<p class="saves-picker__empty">No saved projects in <code>saves/</code> yet.</p>`
        }
        <div class="saves-picker__actions">
          <button type="button" class="saves-picker__cancel">Cancel</button>
          ${
            window.showOpenFilePicker
              ? '<button type="button" class="saves-picker__browse">Browse saves folder…</button>'
              : ''
          }
          ${hasFiles ? '<button type="submit" class="saves-picker__open">Open</button>' : ''}
        </div>
      </form>
    `;

    const form = dialog.querySelector('form');
    const cancelBtn = dialog.querySelector('.saves-picker__cancel');
    const browseBtn = dialog.querySelector('.saves-picker__browse');

    cancelBtn.addEventListener('click', () => dialog.close(null));

    browseBtn?.addEventListener('click', () => dialog.close('__browse__'));

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!hasFiles) return;
      const select = form.querySelector('select');
      dialog.close(select.value);
    });

    dialog.addEventListener('close', async () => {
      const name = dialog.returnValue;
      dialog.remove();
      if (!name || name === 'cancel') {
        resolve(null);
        return;
      }
      if (name === '__browse__') {
        try {
          const file = await openWithDirectoryPicker();
          resolve(file ? { __file: file } : null);
        } catch {
          resolve(null);
        }
        return;
      }
      resolve({ filename: name });
    });

    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

async function openWithDirectoryPicker() {
  const dir = await ensureSavesDirHandle();
  if (!dir || !window.showOpenFilePicker) return null;

  const [file] = await window.showOpenFilePicker({
    startIn: dir,
    multiple: false,
    types: [
      {
        description: 'BPT hero project',
        accept: { 'application/json': ['.json'] }
      }
    ]
  });
  return file;
}

function pickProjectFileLegacy() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      resolve(file || null);
    });
    input.click();
  });
}

export async function pickAndReadProject() {
  if (await isSavesApiAvailable()) {
    const stored = await getStoredSavesDirHandle();
    if (stored && window.showOpenFilePicker) {
      try {
        const perm = await stored.queryPermission({ mode: 'read' });
        if (perm === 'granted' || (await stored.requestPermission({ mode: 'read' })) === 'granted') {
          const [file] = await window.showOpenFilePicker({
            startIn: stored,
            multiple: false,
            types: [
              {
                description: 'BPT hero project',
                accept: { 'application/json': ['.json'] }
              }
            ]
          });
          return { text: await file.text(), filename: file.name, via: 'picker' };
        }
      } catch (err) {
        if (err?.name === 'AbortError') return null;
      }
    }

    const chosen = await pickProjectFromSavesList();
    if (!chosen) return null;
    if (chosen.__file) {
      const file = chosen.__file;
      return { text: await file.text(), filename: file.name, via: 'picker' };
    }
    const res = await fetch(`/api/saves/${encodeURIComponent(chosen.filename)}`);
    if (!res.ok) return null;
    return { text: await res.text(), filename: chosen.filename, via: 'saves' };
  }

  const file = await pickProjectFileLegacy();
  if (!file) return null;
  return { text: await file.text(), filename: file.name, via: 'picker' };
}

export async function readFileAsText(file) {
  return file.text();
}
