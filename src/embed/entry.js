import { createAnimationPlayer } from '../animation-player.js';
import { createDefaultSettings, mergeSettings } from '../settings.js';

function expandSettings(partial) {
  return mergeSettings({ ...createDefaultSettings(), ...partial });
}

function readSettings(root) {
  const node = root.querySelector('script.bpt-hero-settings');
  if (!node) {
    const fallback = window.__BPT_HERO__;
    return fallback?.settings ?? fallback ?? {};
  }
  try {
    const data = JSON.parse(node.textContent || '{}');
    return data.settings ?? data;
  } catch {
    return {};
  }
}

function mountRoot(root) {
  if (root.dataset.bptMounted === '1') return;
  root.dataset.bptMounted = '1';
  const settings = expandSettings(readSettings(root));
  const player = createAnimationPlayer(root, settings, { aspectFit: 'slice' });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) {
    player.start();
  } else {
    player.render();
  }
}

function mount() {
  document.querySelectorAll('.bpt-hero-embed').forEach(mountRoot);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
