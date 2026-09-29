import { SPEED_MAX, SPEED_MIN } from './phase-speeds.js';

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function controlRow(label, id, input) {
  const wrap = el('div', 'control');
  const header = el('div', 'control-header');
  const labelSpan = el('span', '', label);
  const valueSpan = el('span', 'value');
  valueSpan.id = `${id}Value`;
  header.append(labelSpan, valueSpan);
  if (input.id !== id) input.id = id;
  wrap.append(header, input);
  return { wrap, input, valueSpan };
}

function range(id, min, max, step, value) {
  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  return input;
}

function numberInput(id, min, max, step, value) {
  const input = document.createElement('input');
  input.type = 'number';
  input.id = id;
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  return input;
}

function colorInput(id, value) {
  const input = document.createElement('input');
  input.type = 'color';
  input.id = id;
  input.value = value;
  return input;
}

function selectInput(id, options, value) {
  const input = document.createElement('select');
  input.id = id;
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = String(opt.value);
    o.textContent = opt.label;
    input.appendChild(o);
  }
  input.value = String(value);
  return input;
}

function checkbox(id, labelText) {
  const label = el('label', 'check');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  const span = el('span', '', labelText);
  label.append(input, span);
  return { wrap: label, input };
}

export function syncSpeedLinkUi(api, settings) {
  const linked = settings.speedsLinked !== false;
  if (api.speedLinkBtn) {
    api.speedLinkBtn.textContent = linked ? 'Unlink' : 'Link';
  }
  if (api.speedInput) {
    api.speedInput.disabled = !linked;
  }
  if (api.phaseSpeedsEl) {
    api.phaseSpeedsEl.classList.toggle('is-collapsed', linked);
  }
  const phaseKeys = ['entrySpeed', 'circleSpeed', 'mapSpeed', 'exitSpeed'];
  for (const key of phaseKeys) {
    const meta = api.bindings[key];
    if (meta?.input) meta.input.disabled = linked;
  }
}

export function mountPanel(container, {
  onChange,
  onPlayToggle,
  onRestart,
  onScrub,
  onSave,
  onSaveAs,
  onOpen,
  onRename,
  onNewProject,
  onExport,
  onExportEmbed,
  onCopyEmbed,
  onChooseExportFolder,
  onSpeedLinkToggle
}) {
  const panel = el('aside', 'controls');

  const header = el('div', 'panel-header');
  const logo = el('img', 'logo');
  logo.src = '/logo.svg';
  logo.alt = 'Beacon';
  header.append(logo, el('span', 'brand', 'Beacon'));

  panel.append(header);

  function section(title) {
    const g = el('div', 'group');
    g.append(el('h2', '', title));
    panel.append(g);
    return g;
  }

  const bindings = {};

  function addRange(group, label, id, min, max, step, value) {
    const input = range(id, min, max, step, value);
    const { wrap, valueSpan } = controlRow(label, id, input);
    group.append(wrap);
    bindings[id] = { input, valueSpan, kind: 'range' };
    return input;
  }

  function addNumber(group, label, id, min, max, step, value) {
    const input = numberInput(id, min, max, step, value);
    const { wrap, valueSpan } = controlRow(label, id, input);
    group.append(wrap);
    bindings[id] = { input, valueSpan, kind: 'number' };
  }

  function addColor(group, label, id, value) {
    const input = colorInput(id, value);
    const wrap = el('div', 'control');
    wrap.append(el('div', 'control-header', `<span>${label}</span>`));
    wrap.append(input);
    group.append(wrap);
    bindings[id] = { input, kind: 'color' };
  }

  function addSelect(group, label, id, options, value) {
    const input = selectInput(id, options, value);
    const { wrap, valueSpan } = controlRow(label, id, input);
    group.append(wrap);
    bindings[id] = { input, valueSpan, kind: 'select' };
  }

  const frame = section('Frame');
  addNumber(frame, 'Width', 'frameWidth', 320, 4096, 10, 1920);
  addNumber(frame, 'Height', 'frameHeight', 240, 4096, 10, 1080);
  addColor(frame, 'Background', 'backgroundColor', '#ffffff');

  const particles = section('Particles');
  addRange(particles, 'Size', 'particleSize', 2, 60, 1, 20);
  addRange(particles, 'Spacing', 'particleSpacing', 4, 160, 1, 39);
  addRange(particles, 'Count', 'particleCount', 1, 80, 1, 40);
  addColor(particles, 'Lead', 'particleColour', '#111111');
  addColor(particles, 'Tail', 'particleEndColour', '#111111');
  addRange(particles, 'Lead opacity', 'particleOpacityStart', 0, 1, 0.01, 1);
  addRange(particles, 'Tail opacity', 'particleOpacityEnd', 0, 1, 0.01, 1);

  const motion = section('Motion');

  const speedControlWrap = el('div', 'control');
  const speedHeader = el('div', 'control-header');
  const speedLabel = el('span', '', 'Speed');
  const speedValueSpan = el('span', 'value');
  speedValueSpan.id = 'speedValue';
  speedHeader.append(speedLabel, speedValueSpan);
  const speedRow = el('div', 'speed-row');
  const speedInput = range('speed', SPEED_MIN, SPEED_MAX, 5, 700);
  const speedLinkBtn = el('button', 'speed-link-btn', 'Unlink');
  speedLinkBtn.type = 'button';
  speedLinkBtn.id = 'speedLinkToggle';
  speedRow.append(speedInput, speedLinkBtn);
  speedControlWrap.append(speedHeader, speedRow);
  motion.append(speedControlWrap);
  bindings.speed = { input: speedInput, valueSpan: speedValueSpan, kind: 'range' };

  const phaseSpeedsEl = el('div', 'phase-speeds is-collapsed');
  addRange(phaseSpeedsEl, 'Entry speed', 'entrySpeed', SPEED_MIN, SPEED_MAX, 5, 700);
  addRange(phaseSpeedsEl, 'Circle speed', 'circleSpeed', SPEED_MIN, SPEED_MAX, 5, 700);
  addRange(phaseSpeedsEl, 'Map speed', 'mapSpeed', SPEED_MIN, SPEED_MAX, 5, 700);
  addRange(phaseSpeedsEl, 'Exit speed', 'exitSpeed', SPEED_MIN, SPEED_MAX, 5, 700);
  motion.append(phaseSpeedsEl);

  speedLinkBtn.addEventListener('click', () => onSpeedLinkToggle?.());

  addSelect(motion, 'Direction', 'direction', [
    { value: 1, label: 'Forward' },
    { value: -1, label: 'Reverse' }
  ], 1);
  addRange(motion, 'On circle', 'onCircle', 0, 10, 0.1, 2.2);
  addRange(motion, 'Morph', 'morphDuration', 0.1, 10, 0.1, 1.3);
  addRange(motion, 'On map', 'onMap', 0, 10, 0.1, 2);
  addRange(motion, 'Pause', 'pauseDuration', 0, 10, 0.1, 1.6);
  addRange(motion, 'Speed blend', 'speedBlend', 0, 3, 0.05, 0.4);

  const shape = section('Shape');
  addRange(shape, 'Scene scale', 'sceneScale', 0.1, 3, 0.01, 1);
  addRange(shape, 'Circle radius', 'circleRadius', 50, 800, 1, 247);
  addRange(shape, 'Map scale', 'mapScale', 0.2, 3, 0.01, 1);
  addRange(shape, 'Morph align', 'morphAlignment', 0, 100, 0.1, 0);

  const entry = section('Entry');
  addRange(entry, 'Point', 'entryPointPct', 0, 100, 0.1, 58.2);
  addRange(entry, 'Length', 'entryLength', 0, 1500, 1, 210);
  addRange(entry, 'Angle', 'entryAngle', -180, 180, 1, -25);

  const exit = section('Exit');
  addRange(exit, 'Point', 'exitPointPct', 0, 100, 0.1, 21);
  addRange(exit, 'Length', 'exitLength', 0, 1500, 1, 210);
  addRange(exit, 'Angle', 'exitAngle', -180, 180, 1, -25);

  const view = section('View');
  const g1 = checkbox('showGuides', 'Guides');
  const g2 = checkbox('showAnchors', 'Anchors');
  const g3 = checkbox('showOutlines', 'Outlines');
  view.append(g1.wrap, g2.wrap, g3.wrap);
  bindings.showGuides = { input: g1.input, kind: 'checkbox' };
  bindings.showAnchors = { input: g2.input, kind: 'checkbox' };
  bindings.showOutlines = { input: g3.input, kind: 'checkbox' };

  const playback = section('Playback');
  const playRow = el('div', 'button-row');
  const playBtn = el('button', '', 'Pause');
  playBtn.id = 'togglePlayback';
  const restartBtn = el('button', '', 'Restart');
  restartBtn.id = 'restart';
  playRow.append(playBtn, restartBtn);
  playback.append(playRow);
  const scrub = document.createElement('input');
  scrub.type = 'range';
  scrub.id = 'scrubber';
  scrub.min = '0';
  scrub.max = '1000';
  scrub.step = '1';
  scrub.value = '0';
  playback.append(scrub);
  const stats = el('div', 'stats');
  stats.id = 'stats';
  playback.append(stats);

  const project = section('Project');
  const projectLabel = el('div', 'project-label');
  projectLabel.id = 'projectLabel';
  projectLabel.textContent = 'Project: Untitled';
  project.append(projectLabel);
  const projectRow = el('div', 'button-row');
  const saveBtn = el('button', '', 'Save');
  saveBtn.id = 'saveProject';
  saveBtn.title = 'Save (⌘S)';
  const saveAsBtn = el('button', '', 'Save As');
  saveAsBtn.id = 'saveProjectAs';
  saveAsBtn.title = 'Save As (⇧⌘S)';
  const openBtn = el('button', '', 'Open');
  openBtn.id = 'openProject';
  projectRow.append(saveBtn, saveAsBtn, openBtn);
  project.append(projectRow);
  const projectRow2 = el('div', 'button-row');
  const renameBtn = el('button', '', 'Rename…');
  renameBtn.id = 'renameProject';
  renameBtn.disabled = true;
  const newBtn = el('button', '', 'New');
  newBtn.id = 'newProject';
  newBtn.title = 'New project (⌘N)';
  projectRow2.append(renameBtn, newBtn);
  project.append(projectRow2);
  const status = el('div', 'status');
  status.id = 'projectStatus';
  project.append(status);

  const exportSec = section('Export');
  const exportNameWrap = el('div', 'control');
  exportNameWrap.append(el('div', 'control-header', '<span>File name</span>'));
  const exportFilenameInput = document.createElement('input');
  exportFilenameInput.type = 'text';
  exportFilenameInput.id = 'exportFilename';
  exportFilenameInput.className = 'text-input';
  exportFilenameInput.autocomplete = 'off';
  exportNameWrap.append(exportFilenameInput);
  exportSec.append(exportNameWrap);
  const exportFolderRow = el('div', 'export-folder-row');
  const exportFolderLabel = el('span', 'export-folder-label');
  exportFolderLabel.id = 'exportFolderLabel';
  exportFolderLabel.textContent = 'exports/';
  const chooseExportFolderBtn = el('button', 'export-folder-btn', 'Choose folder…');
  chooseExportFolderBtn.type = 'button';
  chooseExportFolderBtn.id = 'chooseExportFolder';
  exportFolderRow.append(exportFolderLabel, chooseExportFolderBtn);
  exportSec.append(exportFolderRow);
  addSelect(exportSec, 'FPS', 'exportFps', [
    { value: 24, label: '24' },
    { value: 30, label: '30' },
    { value: 60, label: '60' }
  ], 60);
  addSelect(exportSec, 'Quality', 'exportQuality', [
    { value: 'standard', label: 'Standard' },
    { value: 'high', label: 'High' },
    { value: 'maximum', label: 'Maximum' }
  ], 'high');
  const exportMp4 = el('button', 'primary', 'Export MP4');
  exportMp4.id = 'exportMp4';
  const exportWebm = el('button', 'primary', 'Export WebM');
  exportWebm.id = 'exportWebm';
  const exportEmbed = el('button', 'primary', 'Export embed');
  exportEmbed.id = 'exportEmbed';
  const copyEmbed = el('button', '', 'Copy embed');
  copyEmbed.id = 'copyEmbed';
  exportSec.append(exportMp4, exportWebm, exportEmbed, copyEmbed);
  const exportStatus = el('div', 'status');
  exportStatus.id = 'exportStatus';
  exportSec.append(exportStatus);

  container.append(panel);

  const allInputs = panel.querySelectorAll('input, select');
  allInputs.forEach(input => {
    input.addEventListener('input', () => onChange());
    input.addEventListener('change', () => onChange());
  });

  playBtn.addEventListener('click', onPlayToggle);
  restartBtn.addEventListener('click', onRestart);
  scrub.addEventListener('input', () => onScrub(Number(scrub.value) / 1000));
  saveBtn.addEventListener('click', onSave);
  saveAsBtn.addEventListener('click', onSaveAs);
  openBtn.addEventListener('click', onOpen);
  renameBtn.addEventListener('click', onRename);
  newBtn.addEventListener('click', onNewProject);
  chooseExportFolderBtn.addEventListener('click', onChooseExportFolder);
  exportMp4.addEventListener('click', () => onExport('mp4'));
  exportWebm.addEventListener('click', () => onExport('webm'));
  exportEmbed.addEventListener('click', () => onExportEmbed?.());
  copyEmbed.addEventListener('click', () => onCopyEmbed?.());

  return {
    bindings,
    playBtn,
    statsEl: stats,
    scrubber: scrub,
    projectLabelEl: projectLabel,
    projectStatusEl: status,
    renameBtn,
    exportFilenameInput,
    exportFolderLabelEl: exportFolderLabel,
    exportStatusEl: exportStatus,
    exportMp4Btn: exportMp4,
    exportWebmBtn: exportWebm,
    speedInput,
    speedLinkBtn,
    phaseSpeedsEl,
    speedControlWrap
  };
}

export function readSettingsFromPanel(bindings, baseSettings) {
  const s = { ...baseSettings };
  for (const [key, meta] of Object.entries(bindings)) {
    const input = meta.input;
    if (meta.kind === 'checkbox') {
      s[key] = input.checked;
    } else if (key === 'direction') {
      s[key] = Number(input.value);
    } else if (key === 'exportFps') {
      s[key] = Number(input.value);
    } else if (key === 'exportQuality') {
      s[key] = input.value;
    } else if (meta.kind === 'color') {
      s[key] = input.value;
    } else {
      s[key] = Number(input.value);
    }
  }
  return s;
}

export function writeSettingsToPanel(bindings, settings, formatters) {
  for (const [key, meta] of Object.entries(bindings)) {
    const input = meta.input;
    const val = settings[key];
    if (meta.kind === 'checkbox') {
      input.checked = Boolean(val);
    } else if (meta.kind === 'color') {
      input.value = val;
    } else {
      input.value = String(val);
    }
    if (meta.valueSpan && formatters[key]) {
      meta.valueSpan.textContent = formatters[key](settings);
    }
  }
}

export function syncProjectUi(api, { labelText, renameEnabled }) {
  if (api.projectLabelEl && labelText) {
    api.projectLabelEl.textContent = `Project: ${labelText}`;
  }
  if (api.renameBtn) {
    api.renameBtn.disabled = !renameEnabled;
  }
}

export function formattersForSettings(settings) {
  return {
    particleSize: s => `${s.particleSize}px`,
    particleSpacing: s => `${s.particleSpacing}px`,
    particleCount: s => String(s.particleCount),
    particleOpacityStart: s => s.particleOpacityStart.toFixed(2),
    particleOpacityEnd: s => s.particleOpacityEnd.toFixed(2),
    speed: s => `${s.speed}px/s`,
    entrySpeed: s => `${s.entrySpeed}px/s`,
    circleSpeed: s => `${s.circleSpeed}px/s`,
    mapSpeed: s => `${s.mapSpeed}px/s`,
    exitSpeed: s => `${s.exitSpeed}px/s`,
    onCircle: s => `${s.onCircle.toFixed(1)}s`,
    morphDuration: s => `${s.morphDuration.toFixed(1)}s`,
    onMap: s => `${s.onMap.toFixed(1)}s`,
    pauseDuration: s => `${s.pauseDuration.toFixed(1)}s`,
    speedBlend: s => `${s.speedBlend.toFixed(2)}s`,
    sceneScale: s => s.sceneScale.toFixed(2),
    circleRadius: s => `${Math.round(s.circleRadius)}`,
    mapScale: s => s.mapScale.toFixed(2),
    morphAlignment: s => `${s.morphAlignment.toFixed(1)}%`,
    entryPointPct: s => `${s.entryPointPct.toFixed(1)}%`,
    entryLength: s => `${s.entryLength}px`,
    entryAngle: s => `${s.entryAngle}°`,
    exitPointPct: s => `${s.exitPointPct.toFixed(1)}%`,
    exitLength: s => `${s.exitLength}px`,
    exitAngle: s => `${s.exitAngle}°`,
    frameWidth: s => String(s.frameWidth),
    frameHeight: s => String(s.frameHeight),
    direction: () => '',
    exportFps: () => '',
    exportQuality: () => ''
  };
}
