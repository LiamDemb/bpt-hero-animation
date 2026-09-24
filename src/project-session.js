let saveFilename = null;
let isDirty = false;

export function getSaveFilename() {
  return saveFilename;
}

export function getIsDirty() {
  return isDirty;
}

export function displayLabel() {
  return saveFilename ?? 'Untitled';
}

export function exportStem() {
  if (!saveFilename) return 'untitled';
  return saveFilename.replace(/\.json$/i, '') || 'untitled';
}

export function sanitizeSaveFilename(input) {
  let name = String(input ?? '').trim();
  if (!name) return null;
  name = name.replace(/^.*[/\\]/, '');
  if (!name.toLowerCase().endsWith('.json')) {
    name = `${name}.json`;
  }
  name = name.replace(/[/\\?%*:|"<>]/g, '-');
  if (!name.endsWith('.json') || name === '.json') return null;
  return name;
}

export function bindProject(filename) {
  if (!filename) {
    saveFilename = null;
    return;
  }
  saveFilename = sanitizeSaveFilename(filename) ?? String(filename).replace(/^.*[/\\]/, '');
}

export function clearBinding() {
  saveFilename = null;
}

export function markDirty() {
  isDirty = true;
}

export function clearDirty() {
  isDirty = false;
}

export function resetSession() {
  saveFilename = null;
  isDirty = false;
}

export function formatProjectStatus({ saved = false } = {}) {
  const label = displayLabel();
  if (saved) return `Saved · ${label}`;
  if (isDirty) return `Edited · ${label}`;
  return label;
}
