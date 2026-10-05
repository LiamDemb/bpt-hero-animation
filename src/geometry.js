import { AUS_PATH_D } from './aus-path.js';

const PATH_MEASURE_EL = typeof document !== 'undefined'
  ? document.createElementNS('http://www.w3.org/2000/svg', 'path')
  : null;

export function measurePathLength(d) {
  if (!PATH_MEASURE_EL) return 1554.5;
  PATH_MEASURE_EL.setAttribute('d', d);
  return PATH_MEASURE_EL.getTotalLength();
}

export function sampleSvgPath(d, count) {
  if (!PATH_MEASURE_EL) return [];
  PATH_MEASURE_EL.setAttribute('d', d);
  const length = PATH_MEASURE_EL.getTotalLength();
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i / count) * length;
    const p = PATH_MEASURE_EL.getPointAtLength(t);
    points.push({ x: p.x, y: p.y });
  }
  return { points, length };
}

export function sampleCircle(radius, count) {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    // Negative angle: polyline walks anticlockwise on screen (SVG y-down), matching entry flow.
    const a = -(i / count) * Math.PI * 2;
    points.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
  }
  const length = 2 * Math.PI * radius;
  return { points, length };
}

export function boundingBoxCenter(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  if (!points.length) return { x: 0, y: 0 };
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

export function translatePoints(points, dx, dy) {
  return points.map(p => ({ x: p.x + dx, y: p.y + dy }));
}

export function scalePoints(points, sx, sy, origin = { x: 0, y: 0 }) {
  return points.map(p => ({
    x: origin.x + (p.x - origin.x) * sx,
    y: origin.y + (p.y - origin.y) * sy
  }));
}

export function polylineLength(points) {
  let len = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

export function resampleClosedPolyline(points, targetCount) {
  if (points.length < 2) return points;
  const segments = [];
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, len });
    total += len;
  }
  const out = [];
  for (let i = 0; i < targetCount; i += 1) {
    let dist = (i / targetCount) * total;
    for (const seg of segments) {
      if (dist <= seg.len || seg === segments[segments.length - 1]) {
        const t = seg.len > 0 ? dist / seg.len : 0;
        out.push({
          x: seg.a.x + (seg.b.x - seg.a.x) * t,
          y: seg.a.y + (seg.b.y - seg.a.y) * t
        });
        break;
      }
      dist -= seg.len;
    }
  }
  return { points: out, length: total };
}

export function rotatePointsIndex(points, offsetIndex) {
  const n = points.length;
  if (n === 0) return points;
  const shift = ((Math.round(offsetIndex) % n) + n) % n;
  return [...points.slice(shift), ...points.slice(0, shift)];
}

/** Signed area in SVG coordinates (y-down); sign indicates traversal winding. */
export function signedArea2D(points) {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const p = points[i];
    const q = points[(i + 1) % n];
    area += p.x * q.y - q.x * p.y;
  }
  return area * 0.5;
}

/** Reverse closed-loop direction while keeping the same start vertex for index-aligned morphs. */
export function reverseWindingKeepingOrigin(points) {
  if (points.length <= 1) return points;
  return [points[0], ...points.slice(1).reverse()];
}

export function alignWindingTo(reference, points) {
  const refArea = signedArea2D(reference);
  const ptsArea = signedArea2D(points);
  if (refArea === 0 || ptsArea === 0) return points;
  if (refArea * ptsArea < 0) {
    return reverseWindingKeepingOrigin(points);
  }
  return points;
}

export function blendPolylines(a, b, t) {
  const n = Math.min(a.length, b.length);
  const points = [];
  for (let i = 0; i < n; i += 1) {
    points.push({
      x: a[i].x + (b[i].x - a[i].x) * t,
      y: a[i].y + (b[i].y - a[i].y) * t
    });
  }
  return points;
}

export function pointAtPolylineDistance(points, distance) {
  const len = polylineLength(points);
  if (len <= 0) return { x: 0, y: 0 };
  let d = ((distance % len) + len) % len;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (d <= seg || seg === 0) {
      const t = seg > 0 ? d / seg : 0;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
      };
    }
    d -= seg;
  }
  return points[0];
}

export function polylineToPathD(points) {
  if (!points.length) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map(p => `L ${p.x} ${p.y}`).join(' ')} Z`;
}

export function polar(angleDeg, length) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(rad) * length, y: Math.sin(rad) * length };
}

export function lerpPoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(ch => ch + ch).join('') : clean;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

export function mix(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Map route-space travel (integrated at constant px/s against circle length) onto a
 * deforming outline whose perimeter may change during morphs.
 */
export function outlineRouteDistance(entryFrac, outlineTravel, outlineLength, refLength, direction) {
  const ref = refLength > 0 ? refLength : outlineLength;
  const routeS =
    direction === 1
      ? entryFrac * ref + outlineTravel
      : entryFrac * ref - outlineTravel;
  return ref > 0 ? routeS * (outlineLength / ref) : outlineLength * entryFrac + outlineTravel;
}

function sampleScaledPathPoints(pathD, scale, sampleCount) {
  const mapSample = sampleSvgPath(pathD, sampleCount);
  const mapC = boundingBoxCenter(mapSample.points);
  let mapPts = translatePoints(mapSample.points, -mapC.x, -mapC.y);
  mapPts = scalePoints(mapPts, scale, scale, { x: 0, y: 0 });
  const mapResampled = resampleClosedPolyline(mapPts, sampleCount);
  return { points: mapResampled.points, length: mapResampled.length };
}

function mapPointsFromPath(pathD, scale, alignPct, sampleCount) {
  const { points, length } = sampleScaledPathPoints(pathD, scale, sampleCount);
  const alignShift = Math.round((alignPct / 100) * sampleCount);
  const mapAligned = rotatePointsIndex(points, alignShift);
  return { points: mapAligned, length };
}

function morphCorrespondenceScore(reference, target) {
  const n = Math.min(reference.length, target.length);
  let score = 0;
  for (let i = 0; i < n; i += 1) {
    score += Math.hypot(reference[i].x - target[i].x, reference[i].y - target[i].y);
  }
  return score;
}

/** Pick index-aligned target that morphs cleanly into reference (winding + reversed loop). */
export function chooseMorphCorrespondence(reference, target) {
  const aligned = alignWindingTo(reference, target);
  const reversed = alignWindingTo(reference, reverseWindingKeepingOrigin(target));
  return morphCorrespondenceScore(reference, aligned) <= morphCorrespondenceScore(reference, reversed)
    ? aligned
    : reversed;
}

export function isAustraliaStoryboard(settings) {
  return settings.storyboard === 'australia';
}

export function buildShapeContext(settings, waPathD, ausPathD = AUS_PATH_D) {
  const SAMPLE_COUNT = 256;
  const circleSample = sampleCircle(settings.circleRadius, SAMPLE_COUNT);
  const circleResampled = resampleClosedPolyline(circleSample.points, SAMPLE_COUNT);
  const circlePoints = circleResampled.points;

  const ausSample = sampleScaledPathPoints(ausPathD, settings.ausScale ?? 1, SAMPLE_COUNT);
  const ausAlignShift = Math.round(((settings.ausAlign ?? 0) / 100) * SAMPLE_COUNT);
  const ausBasePts = alignWindingTo(circlePoints, ausSample.points);
  const ausPoints = rotatePointsIndex(ausBasePts, ausAlignShift);

  const waSample = sampleScaledPathPoints(waPathD, settings.mapScale, SAMPLE_COUNT);
  const waBasePts = alignWindingTo(circlePoints, waSample.points);
  const morphAlignShift = Math.round((settings.morphAlignment / 100) * SAMPLE_COUNT);
  const ausToWaShift = Math.round(((settings.ausToWaAlign ?? 0) / 100) * SAMPLE_COUNT);
  const mapPoints = rotatePointsIndex(waBasePts, morphAlignShift);
  let mapPointsFromAus = rotatePointsIndex(waBasePts, ausToWaShift);
  mapPointsFromAus = chooseMorphCorrespondence(ausPoints, mapPointsFromAus);

  return {
    sampleCount: SAMPLE_COUNT,
    circlePoints,
    ausPoints,
    mapPoints,
    mapPointsFromAus,
    circleLength: circleResampled.length,
    ausLength: polylineLength(ausPoints),
    mapLength: waSample.length
  };
}

export function outlineAtTime(shapeCtx, renderTime, timeline, settings) {
  const australia = isAustraliaStoryboard(settings);
  if (!australia) {
    const { morphStart, morphDuration, morphEased } = timeline;
    let t = 0;
    if (renderTime > morphStart) {
      const raw = (renderTime - morphStart) / Math.max(morphDuration, 0.001);
      t = morphEased ? morphEased(raw) : Math.max(0, Math.min(1, raw));
    }
    return blendPolylines(shapeCtx.circlePoints, shapeCtx.mapPoints, t);
  }

  const {
    ausMorphStart,
    ausMorphDuration,
    ausHoldEnd,
    waMorphEnd,
    waMorphDuration,
    morphEased
  } = timeline;

  if (renderTime < ausMorphStart) {
    return shapeCtx.circlePoints;
  }
  if (renderTime < ausMorphStart + ausMorphDuration) {
    const raw = (renderTime - ausMorphStart) / Math.max(ausMorphDuration, 0.001);
    const t = morphEased(raw);
    return blendPolylines(shapeCtx.circlePoints, shapeCtx.ausPoints, t);
  }
  if (renderTime < ausHoldEnd) {
    return shapeCtx.ausPoints;
  }
  if (renderTime < waMorphEnd) {
    const morph2Start = ausHoldEnd;
    const raw = (renderTime - morph2Start) / Math.max(waMorphDuration, 0.001);
    const t = morphEased(raw);
    return blendPolylines(shapeCtx.ausPoints, shapeCtx.mapPointsFromAus, t);
  }
  return shapeCtx.mapPointsFromAus;
}
