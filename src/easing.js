const PRESET_BEZIER = {
  linear: [0, 0, 1, 1],
  smooth: [0.42, 0, 0.58, 1],
  ease: [0.25, 0.1, 0.25, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  easeInCubic: [0.32, 0, 0.67, 0],
  easeOutCubic: [0.33, 1, 0.68, 1],
  easeInOutCubic: [0.65, 0, 0.35, 1]
};

export const EASING_OPTIONS = [
  { value: 'linear', label: 'Linear' },
  { value: 'smooth', label: 'Smooth' },
  { value: 'ease', label: 'Ease' },
  { value: 'easeIn', label: 'Ease in' },
  { value: 'easeOut', label: 'Ease out' },
  { value: 'easeInOut', label: 'Ease in-out' },
  { value: 'easeInCubic', label: 'Ease in cubic' },
  { value: 'easeOutCubic', label: 'Ease out cubic' },
  { value: 'easeInOutCubic', label: 'Ease in-out cubic' }
];

const VALID_IDS = new Set(EASING_OPTIONS.map(o => o.value));

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

function bezierPoint(t, p0, p1, p2, p3) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function bezierYAtX(x, x1, y1, x2, y2) {
  const target = clamp01(x);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    const bx = bezierPoint(mid, 0, x1, x2, 1);
    if (bx < target) lo = mid;
    else hi = mid;
  }
  const t = (lo + hi) / 2;
  return clamp01(bezierPoint(t, 0, y1, y2, 1));
}

export function normalizeEasingId(id) {
  if (typeof id === 'string' && VALID_IDS.has(id)) return id;
  if (id === 'smooth' || id === 'linear') return id;
  return 'linear';
}

export function evaluateEasing(id, u) {
  const t = clamp01(u);
  const preset = PRESET_BEZIER[normalizeEasingId(id)];
  if (!preset) return t;
  const [x1, y1, x2, y2] = preset;
  if (x1 === 0 && y1 === 0 && x2 === 1 && y2 === 1) return t;
  return bezierYAtX(t, x1, y1, x2, y2);
}

/** @deprecated use evaluateEasing */
export function applyEasing(t, easing) {
  return evaluateEasing(easing, t);
}
