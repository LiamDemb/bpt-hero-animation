import fs from 'fs';
import { PNG } from 'pngjs';

function readPng(path) {
  const png = PNG.sync.read(fs.readFileSync(path));
  const { width: w, height: h, data } = png;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      mask[y * w + x] = a > 128 && r + g + b < 600 ? 1 : 0;
    }
  }
  return { w, h, mask };
}

function findComponents(mask, w, h) {
  const visited = new Uint8Array(w * h);
  const components = [];
  const stack = [];
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = y * w + x;
      if (!mask[idx] || visited[idx]) continue;
      const pixels = [];
      stack.push(idx);
      visited[idx] = 1;
      while (stack.length) {
        const cur = stack.pop();
        const cx = cur % w;
        const cy = (cur / w) | 0;
        pixels.push([cx, cy]);
        const nbs = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1]
        ];
        for (const [nx, ny] of nbs) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (!mask[ni] || visited[ni]) continue;
          visited[ni] = 1;
          stack.push(ni);
        }
      }
      components.push(pixels);
    }
  }
  return components;
}

function bbox(pixels) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pixels) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX, maxX, minY, maxY, area: pixels.length };
}

function traceBoundary(mask, w, h, compSet) {
  const inSet = new Set(compSet.map(([x, y]) => y * w + x));
  let start = null;
  for (const [x, y] of compSet) {
    if (!inSet.has(y * w + (x - 1))) {
      start = [x, y];
      break;
    }
  }
  if (!start) return [];

  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1]
  ];
  const contour = [];
  let [x, y] = start;
  let dir = 0;
  const maxSteps = compSet.length * 4 + 10;
  for (let step = 0; step < maxSteps; step += 1) {
    contour.push([x, y]);
    let turned = false;
    for (let t = 0; t < 4; t += 1) {
      const nd = (dir + 3 + t) % 4;
      const [dx, dy] = dirs[nd];
      const nx = x + dx;
      const ny = y + dy;
      if (inSet.has(ny * w + nx)) {
        x = nx;
        y = ny;
        dir = nd;
        turned = true;
        break;
      }
    }
    if (!turned) break;
    if (x === start[0] && y === start[1] && contour.length > 3) break;
  }
  return contour;
}

function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  const sqTol = tolerance * tolerance;

  function perpDist(p, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (dx === 0 && dy === 0) {
      const ex = p[0] - a[0];
      const ey = p[1] - a[1];
      return ex * ex + ey * ey;
    }
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
    const projX = a[0] + t * dx;
    const projY = a[1] + t * dy;
    const ex = p[0] - projX;
    const ey = p[1] - projY;
    return ex * ex + ey * ey;
  }

  function rdp(pts) {
    let maxDist = 0;
    let idx = 0;
    const end = pts.length - 1;
    for (let i = 1; i < end; i += 1) {
      const d = perpDist(pts[i], pts[0], pts[end]);
      if (d > maxDist) {
        maxDist = d;
        idx = i;
      }
    }
    if (maxDist > sqTol) {
      const left = rdp(pts.slice(0, idx + 1));
      const right = rdp(pts.slice(idx));
      return left.slice(0, -1).concat(right);
    }
    return [pts[0], pts[end]];
  }

  return rdp(points);
}

function toPathD(points) {
  if (!points.length) return '';
  const [first, ...rest] = points;
  const fmt = n => Number(n.toFixed(3));
  let d = `M${fmt(first[0])} ${fmt(first[1])}`;
  for (const [x, y] of rest) {
    d += `L${fmt(x)} ${fmt(y)}`;
  }
  return `${d}Z`;
}

const pngPath =
  process.argv[2] ||
  '/Users/liamdemb/.cursor/projects/Users-liamdemb-Projects-Beacon-Proton-Therapy-bpt-hero-animation/assets/Vector-9dda2ce6-621e-4ad2-8a0d-aacb2cc27074.png';
const { w, h, mask } = readPng(pngPath);
const components = findComponents(mask, w, h);
const ranked = components
  .map(c => ({ c, box: bbox(c) }))
  .sort((a, b) => b.box.area - a.box.area);
const mainland = ranked[0].c;
const contour = traceBoundary(mask, w, h, mainland);
const simplified = simplify(contour, 2.5);

const box = bbox(simplified);
const targetW = 380;
const targetH = 340;
const scale = Math.min(targetW / (box.maxX - box.minX), targetH / (box.maxY - box.minY));
const cx = (box.minX + box.maxX) / 2;
const cy = (box.minY + box.maxY) / 2;
const scaled = simplified.map(([x, y]) => [
  (x - cx) * scale + 200,
  (y - cy) * scale + 280
]);

const pathD = toPathD(scaled);
console.log(pathD);
console.error(`points: ${scaled.length}, length chars: ${pathD.length}`);
