import embedCss from './embed/embed.css?raw';
import { createDefaultSettings, mergeSettings } from './settings.js';

export const EMBED_RUNTIME_URL = '/embed/bpt-hero.v1.iife.js';

let cachedRuntime = null;

export function compactSettings(settings) {
  const defaults = createDefaultSettings();
  const merged = mergeSettings(settings);
  const compact = {};
  for (const key of Object.keys(defaults)) {
    const value = merged[key];
    const defaultValue = defaults[key];
    if (JSON.stringify(value) !== JSON.stringify(defaultValue)) {
      compact[key] = value;
    }
  }
  return compact;
}

export async function loadEmbedRuntime() {
  if (cachedRuntime) return cachedRuntime;
  const res = await fetch(EMBED_RUNTIME_URL);
  if (!res.ok) {
    throw new Error('Embed runtime not found. Run: npm run build:embed');
  }
  cachedRuntime = await res.text();
  return cachedRuntime;
}

function escapeScriptClose(script) {
  return script.replace(/<\/script/gi, '<\\/script');
}

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export async function buildEmbedDocument(settings) {
  const runtime = await loadEmbedRuntime();
  const merged = mergeSettings(settings);
  const compact = compactSettings(merged);
  const settingsJson = JSON.stringify(compact);
  const safeRuntime = escapeScriptClose(runtime);
  const frameWidth = merged.frameWidth;
  const frameHeight = merged.frameHeight;
  const backgroundColor = escapeHtmlAttr(merged.backgroundColor);

  const safeSettings = escapeScriptClose(settingsJson);

  return `<div class="bpt-hero-embed" data-frame-width="${frameWidth}" data-frame-height="${frameHeight}" style="aspect-ratio:${frameWidth} / ${frameHeight};background:${backgroundColor}">
  <style>${embedCss}</style>
  <script type="application/json" class="bpt-hero-settings">${safeSettings}</script>
</div>
<script>${safeRuntime}</script>
`;
}
