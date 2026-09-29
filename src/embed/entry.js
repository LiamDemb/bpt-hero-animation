import { createAnimationPlayer } from '../animation-player.js';
import { createDefaultSettings, mergeSettings } from '../settings.js';

function expandSettings(partial) {
  return mergeSettings({ ...createDefaultSettings(), ...partial });
}

function mount() {
  const root = document.getElementById('bpt-hero') || document.body;
  const payload = window.__BPT_HERO__;
  const settings = expandSettings(payload?.settings ?? payload ?? {});

  const player = createAnimationPlayer(root, settings, { aspectFit: 'slice' });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) {
    player.start();
  } else {
    player.render();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
