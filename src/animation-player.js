import { createPreviewRenderer } from './render.js';
import { computeFitSceneScale, createSampler } from './simulation.js';
import { mergeSettings } from './settings.js';

export function createAnimationPlayer(containerEl, settingsInput, { aspectFit = 'meet' } = {}) {
  let settings = mergeSettings(settingsInput);
  if (!Number.isFinite(settings.sceneScale) || settings.sceneScale <= 0) {
    settings.sceneScale = computeFitSceneScale(settings);
  }

  let sampler = createSampler(settings);
  const preview = createPreviewRenderer(containerEl, { aspectFit });
  let cycleTime = 0;
  let playing = true;
  let rafId = null;
  let lastTs = null;
  let advanceFn = () => playing;

  function render() {
    const duration = sampler.duration || 0;
    const t = duration > 0 ? Math.max(0, Math.min(cycleTime, duration)) : 0;
    const sampleResult = sampler.sample(t);
    preview.renderFrame(settings, sampleResult);
    return { t, sampleResult, duration };
  }

  function rebuild(newSettings, { preserveTime = true } = {}) {
    const prevDuration = sampler.duration;
    settings = mergeSettings(newSettings);
    sampler = createSampler(settings);
    if (preserveTime && prevDuration > 0 && sampler.duration > 0) {
      cycleTime = (cycleTime / prevDuration) * sampler.duration;
    } else if (!preserveTime) {
      cycleTime = 0;
    }
    return render();
  }

  function frame(ts) {
    if (lastTs == null) lastTs = ts;
    const dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (advanceFn() && sampler.duration > 0) {
      cycleTime = (cycleTime + dt) % sampler.duration;
    }
    return render();
  }

  function start() {
    if (rafId != null) return;
    const loop = ts => {
      frame(ts);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTs = null;
  }

  function destroy() {
    stop();
    containerEl.replaceChildren();
  }

  return {
    get settings() {
      return settings;
    },
    get sampler() {
      return sampler;
    },
    get cycleTime() {
      return cycleTime;
    },
    set cycleTime(value) {
      cycleTime = value;
    },
    get playing() {
      return playing;
    },
    set playing(value) {
      playing = Boolean(value);
    },
    setAdvancePredicate(fn) {
      advanceFn = typeof fn === 'function' ? fn : () => playing;
    },
    render,
    rebuild,
    frame,
    start,
    stop,
    destroy
  };
}
