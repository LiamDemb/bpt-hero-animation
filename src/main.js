import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import './styles.css';

import { canExportFormat, exportAnimation } from './export-video.js';
import {
  chooseExportFolder,
  defaultExportBasename,
  getExportFolderLabel,
  isExportsApiAvailable,
  sanitizeExportFilename,
  writeExport
} from './export-io.js';
import {
  parseProjectFile,
  pickAndReadProject,
  promptRenameFilename,
  readFileAsText,
  renameProjectFile,
  saveProjectDocument,
  listSaveFiles
} from './project-file.js';
import {
  bindProject,
  clearBinding,
  clearDirty,
  displayLabel,
  exportStem,
  formatProjectStatus,
  getSaveFilename,
  getIsDirty,
  markDirty,
  resetSession
} from './project-session.js';
import {
  formattersForSettings,
  mountPanel,
  readSettingsFromPanel,
  syncProjectUi,
  syncSpeedLinkUi,
  writeSettingsToPanel
} from './panel.js';
import { createPreviewRenderer } from './render.js';
import { computeFitSceneScale, createSampler } from './simulation.js';
import { createDefaultSettings, mergeSettings } from './settings.js';

const app = document.getElementById('app');
app.innerHTML = '<div class="stage" id="stage"></div>';

const stageEl = document.getElementById('stage');
const preview = createPreviewRenderer(stageEl);

let settings = createDefaultSettings();
settings.sceneScale = computeFitSceneScale(settings);

let sampler = createSampler(settings);
let playing = true;
let scrubbing = false;
let cycleTime = 0;
let lastTs = null;
let exportCancel = false;
let exportBusy = false;
let useCustomExportFolder = false;

const panelApi = mountPanel(app, {
  onChange: () => {
    markDirty();
    updateProjectUi();
    refresh({ preserveTime: true });
  },
  onPlayToggle: () => {
    playing = !playing;
    panelApi.playBtn.textContent = playing ? 'Pause' : 'Play';
  },
  onRestart: () => {
    cycleTime = 0;
    updateFrame();
  },
  onScrub: frac => {
    scrubbing = true;
    cycleTime = frac * sampler.duration;
    updateFrame();
    scrubbing = false;
  },
  onSave: () => performSave('save'),
  onSaveAs: () => performSave('saveAs'),
  onOpen: async () => {
    const picked = await pickAndReadProject();
    if (!picked) return;
    await loadProjectFromPick(picked);
  },
  onRename: async () => {
    const current = getSaveFilename();
    if (!current) return;
    const files = await listSaveFiles();
    const to = await promptRenameFilename(current, files);
    if (!to) return;
    const result = await renameProjectFile(current, to);
    if (!result.ok) {
      panelApi.projectStatusEl.textContent = result.error || 'Rename cancelled.';
      return;
    }
    bindProject(result.filename);
    updateProjectUi({ saved: true });
  },
  onNewProject: () => {
    if (getIsDirty() && !window.confirm('Discard unsaved changes?')) return;
    settings = createDefaultSettings();
    settings.sceneScale = computeFitSceneScale(settings);
    resetSession();
    writeSettingsToPanel(panelApi.bindings, settings, formattersForSettings(settings));
    syncSpeedLinkUi(panelApi, settings);
    syncExportFilenameDefault();
    refresh({ preserveTime: false });
    updateProjectUi();
  },
  onChooseExportFolder: async () => {
    const ok = await chooseExportFolder();
    if (ok) {
      useCustomExportFolder = true;
      await updateExportFolderLabel();
    }
  },
  onExport: async format => {
    if (exportBusy) {
      exportCancel = true;
      return;
    }
    await runExport(format);
  },
  onSpeedLinkToggle: () => {
    settings = readSettingsFromPanel(panelApi.bindings, settings);
    settings.speedsLinked = !settings.speedsLinked;
    if (settings.speedsLinked) {
      const master = settings.speed;
      settings.entrySpeed = master;
      settings.circleSpeed = master;
      settings.mapSpeed = master;
      settings.exitSpeed = master;
    }
    settings = mergeSettings(settings);
    writeSettingsToPanel(panelApi.bindings, settings, formattersForSettings(settings));
    syncSpeedLinkUi(panelApi, settings);
    markDirty();
    updateProjectUi();
    refresh({ preserveTime: true });
  }
});

writeSettingsToPanel(panelApi.bindings, settings, formattersForSettings(settings));
syncSpeedLinkUi(panelApi, settings);
panelApi.playBtn.textContent = 'Pause';
syncExportFilenameDefault();
updateProjectUi();
updateExportFolderLabel();
updateExportButtons();

function syncExportFilenameDefault() {
  const stem = exportStem();
  panelApi.exportFilenameInput.value = stem;
}

async function updateExportFolderLabel() {
  const apiOk = await isExportsApiAvailable();
  panelApi.exportFolderLabelEl.textContent = getExportFolderLabel(useCustomExportFolder, apiOk);
}

function updateProjectUi({ saved = false } = {}) {
  syncProjectUi(panelApi, {
    labelText: displayLabel(),
    renameEnabled: Boolean(getSaveFilename())
  });
  panelApi.projectStatusEl.textContent = formatProjectStatus({ saved });
}

async function performSave(mode) {
  settings = readSettingsFromPanel(panelApi.bindings, settings);
  const result = await saveProjectDocument(settings, { mode });
  if (result.cancelled) return;
  if (!result.ok) {
    panelApi.projectStatusEl.textContent = result.error || 'Save failed.';
    return;
  }
  bindProject(result.filename);
  clearDirty();
  if (result.via === 'saves') {
    panelApi.projectStatusEl.textContent = `Saved · ${result.filename}`;
  } else {
    panelApi.projectStatusEl.textContent = `Saved (download) · ${result.filename}`;
  }
  updateProjectUi({ saved: true });
  syncExportFilenameDefault();
}

function refresh({ preserveTime = true } = {}) {
  const prevDuration = sampler.duration;
  settings = readSettingsFromPanel(panelApi.bindings, settings);
  settings = mergeSettings(settings);
  sampler = createSampler(settings);

  if (preserveTime && prevDuration > 0) {
    const progress = cycleTime / prevDuration;
    cycleTime = progress * sampler.duration;
  } else {
    cycleTime = 0;
  }

  writeSettingsToPanel(panelApi.bindings, settings, formattersForSettings(settings));
  syncSpeedLinkUi(panelApi, settings);
  panelApi.scrubber.max = '1000';
  updateFrame();
}

function updateFrame() {
  const t = Math.max(0, Math.min(cycleTime, sampler.duration));
  const sampleResult = sampler.sample(t);
  preview.renderFrame(settings, sampleResult);
  panelApi.scrubber.value = String(Math.round((t / sampler.duration) * 1000) || 0);
  panelApi.statsEl.innerHTML = [
    `Time <strong>${t.toFixed(2)}s</strong> / ${sampler.duration.toFixed(2)}s`,
    ` · ${sampleResult.phase}`
  ].join('');
}

function tick(ts) {
  if (lastTs == null) lastTs = ts;
  const dt = (ts - lastTs) / 1000;
  lastTs = ts;

  if (playing && !exportBusy && sampler.duration > 0) {
    cycleTime = (cycleTime + dt) % sampler.duration;
    updateFrame();
  }
  requestAnimationFrame(tick);
}

async function loadProjectFromPick(picked) {
  const result = parseProjectFile(picked.text);
  if (!result.ok) {
    panelApi.projectStatusEl.textContent = result.error;
    return;
  }
  settings = result.settings;
  if (picked.filename) {
    bindProject(picked.filename);
  } else {
    clearBinding();
  }
  clearDirty();
  writeSettingsToPanel(panelApi.bindings, settings, formattersForSettings(settings));
  syncSpeedLinkUi(panelApi, settings);
  syncExportFilenameDefault();
  refresh({ preserveTime: false });
  panelApi.projectStatusEl.textContent = `Opened · ${getSaveFilename() ?? picked.filename ?? 'project'}`;
  updateProjectUi({ saved: true });
}

async function loadProjectText(text, filename) {
  await loadProjectFromPick({ text, filename });
}

async function runExport(format) {
  if (!canExportFormat(format)) {
    panelApi.exportStatusEl.textContent = `Cannot encode ${format.toUpperCase()} in this browser.`;
    return;
  }
  settings = readSettingsFromPanel(panelApi.bindings, settings);
  sampler = createSampler(settings);
  exportBusy = true;
  exportCancel = false;
  playing = false;
  panelApi.playBtn.textContent = 'Play';
  panelApi.exportMp4Btn.textContent = format === 'mp4' ? 'Cancel' : 'Export MP4';
  panelApi.exportWebmBtn.textContent = format === 'webm' ? 'Cancel' : 'Export WebM';

  const stemInput = panelApi.exportFilenameInput.value.trim() || exportStem();
  const filename =
    sanitizeExportFilename(stemInput, format) ||
    defaultExportBasename(exportStem(), format);

  try {
    const result = await exportAnimation({
      format,
      settings,
      sampler,
      shouldCancel: () => exportCancel,
      onProgress: (frame, total) => {
        panelApi.exportStatusEl.textContent = `${frame} / ${total}`;
      }
    });
    if (result.cancelled) {
      panelApi.exportStatusEl.textContent = 'Export cancelled.';
      return;
    }
    if (!result.ok || !result.blob) {
      panelApi.exportStatusEl.textContent = 'Export failed.';
      return;
    }
    const writeResult = await writeExport({
      blob: result.blob,
      filename,
      useCustomFolder: useCustomExportFolder
    });
    if (writeResult.cancelled) {
      panelApi.exportStatusEl.textContent = 'Export cancelled.';
    } else if (writeResult.ok) {
      panelApi.exportStatusEl.textContent = `Exported to ${writeResult.path}`;
    }
  } catch (error) {
    console.error(error);
    panelApi.exportStatusEl.textContent = `Export failed: ${error.message || error}`;
  } finally {
    exportBusy = false;
    exportCancel = false;
    panelApi.exportMp4Btn.textContent = 'Export MP4';
    panelApi.exportWebmBtn.textContent = 'Export WebM';
    updateFrame();
  }
}

function updateExportButtons() {
  if (!canExportFormat('mp4')) {
    panelApi.exportMp4Btn.disabled = true;
  }
  if (!canExportFormat('webm')) {
    panelApi.exportWebmBtn.disabled = true;
  }
}

window.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key === 's') {
    e.preventDefault();
    if (e.shiftKey) {
      performSave('saveAs');
    } else {
      performSave('save');
    }
  }
  if (mod && e.key === 'n') {
    e.preventDefault();
    if (getIsDirty() && !window.confirm('Discard unsaved changes?')) return;
    settings = createDefaultSettings();
    settings.sceneScale = computeFitSceneScale(settings);
    resetSession();
    writeSettingsToPanel(panelApi.bindings, settings, formattersForSettings(settings));
    syncSpeedLinkUi(panelApi, settings);
    syncExportFilenameDefault();
    refresh({ preserveTime: false });
    updateProjectUi();
  }
  if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
    e.preventDefault();
    playing = !playing;
    panelApi.playBtn.textContent = playing ? 'Pause' : 'Play';
  }
});

window.addEventListener('dragover', e => {
  e.preventDefault();
});
window.addEventListener('drop', async e => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (!file || !file.name.endsWith('.json')) return;
  await loadProjectText(await readFileAsText(file), file.name);
});

updateFrame();
requestAnimationFrame(tick);
