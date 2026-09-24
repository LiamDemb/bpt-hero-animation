export const SPEED_MIN = 20;
export const SPEED_MAX = 5000;

function clampSpeed(value, fallback) {
  const n = Number(value);
  const base = Number.isFinite(n) ? n : fallback;
  return Math.max(SPEED_MIN, Math.min(SPEED_MAX, base));
}

/** Resolves per-phase px/s. Morph travel and post-gate outline use circle/map respectively. */
export function resolvePhaseSpeeds(settings) {
  const master = clampSpeed(settings.speed, SPEED_MIN);
  if (settings.speedsLinked !== false) {
    return {
      entry: master,
      circle: master,
      morph: master,
      map: master,
      exit: master,
      postGate: master,
      tail: master
    };
  }
  const entry = clampSpeed(settings.entrySpeed, master);
  const circle = clampSpeed(settings.circleSpeed, master);
  const map = clampSpeed(settings.mapSpeed, master);
  const exit = clampSpeed(settings.exitSpeed, master);
  return {
    entry,
    circle,
    morph: circle,
    map,
    exit,
    postGate: map,
    tail: exit
  };
}
