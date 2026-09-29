import { polylineToPathD } from './geometry.js';

export function createPreviewRenderer(rootEl, { aspectFit = 'meet' } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'preview-svg');
  const fit = aspectFit === 'slice' ? 'slice' : 'meet';
  svg.setAttribute('preserveAspectRatio', `xMidYMid ${fit}`);

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('class', 'preview-bg');

  const sceneG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  sceneG.setAttribute('class', 'preview-scene');

  const guideLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const outlineCircle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  outlineCircle.setAttribute('class', 'outline-circle');
  const outlineMap = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  outlineMap.setAttribute('class', 'outline-map');
  const entryGuide = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  entryGuide.setAttribute('class', 'guide-line');
  const exitGuide = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  exitGuide.setAttribute('class', 'guide-line');
  const entryMarker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  entryMarker.setAttribute('class', 'anchor-marker');
  entryMarker.setAttribute('r', '6');
  const exitMarker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  exitMarker.setAttribute('class', 'anchor-marker');
  exitMarker.setAttribute('r', '6');

  guideLayer.append(outlineCircle, outlineMap, entryGuide, exitGuide, entryMarker, exitMarker);

  const particleLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  particleLayer.setAttribute('class', 'particle-layer');

  sceneG.append(guideLayer, particleLayer);
  svg.append(bg, sceneG);
  rootEl.appendChild(svg);

  const particles = [];

  function ensurePool(count) {
    while (particles.length < count) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      particleLayer.appendChild(c);
      particles.push(c);
    }
    particles.forEach((p, i) => {
      p.style.display = i < count ? 'block' : 'none';
    });
  }

  function renderFrame(settings, sampleResult) {
    const { frameWidth, frameHeight, backgroundColor, sceneScale, particleSize } = settings;
    const { dots, guides } = sampleResult;

    svg.setAttribute('viewBox', `0 0 ${frameWidth} ${frameHeight}`);
    bg.setAttribute('width', frameWidth);
    bg.setAttribute('height', frameHeight);
    bg.setAttribute('fill', backgroundColor);

    const cx = frameWidth / 2;
    const cy = frameHeight / 2;
    sceneG.setAttribute('transform', `translate(${cx} ${cy}) scale(${sceneScale})`);

    outlineCircle.setAttribute('d', polylineToPathD(guides.circleOutline));
    outlineMap.setAttribute('d', polylineToPathD(guides.mapOutline));
    outlineCircle.setAttribute('opacity', settings.showOutlines ? '0.35' : '0');
    outlineMap.setAttribute('opacity', settings.showOutlines ? '0.35' : '0');

    const strokeW = Math.max(2, particleSize * 0.2);
    outlineCircle.setAttribute('stroke', '#cccccc');
    outlineMap.setAttribute('stroke', '#cccccc');
    outlineCircle.setAttribute('fill', 'none');
    outlineMap.setAttribute('fill', 'none');
    outlineCircle.setAttribute('stroke-width', strokeW);
    outlineMap.setAttribute('stroke-width', strokeW);

    entryGuide.setAttribute('x1', guides.entryStart.x);
    entryGuide.setAttribute('y1', guides.entryStart.y);
    entryGuide.setAttribute('x2', guides.entryAnchor.x);
    entryGuide.setAttribute('y2', guides.entryAnchor.y);
    exitGuide.setAttribute('x1', guides.exitAnchor.x);
    exitGuide.setAttribute('y1', guides.exitAnchor.y);
    exitGuide.setAttribute('x2', guides.exitEnd.x);
    exitGuide.setAttribute('y2', guides.exitEnd.y);

    const guideOpacity = settings.showGuides ? 1 : 0;
    entryGuide.setAttribute('opacity', guideOpacity);
    exitGuide.setAttribute('opacity', guideOpacity);
    entryGuide.setAttribute('stroke', settings.particleColour);
    exitGuide.setAttribute('stroke', settings.particleColour);
    entryGuide.setAttribute('stroke-width', particleSize);
    exitGuide.setAttribute('stroke-width', particleSize);
    entryGuide.setAttribute('stroke-linecap', 'round');
    exitGuide.setAttribute('stroke-linecap', 'round');

    entryMarker.setAttribute('cx', guides.entryAnchor.x);
    entryMarker.setAttribute('cy', guides.entryAnchor.y);
    exitMarker.setAttribute('cx', guides.exitAnchor.x);
    exitMarker.setAttribute('cy', guides.exitAnchor.y);
    const anchorOpacity = settings.showAnchors ? 1 : 0;
    entryMarker.setAttribute('opacity', anchorOpacity);
    exitMarker.setAttribute('opacity', anchorOpacity);
    entryMarker.setAttribute('fill', '#d22');
    exitMarker.setAttribute('fill', '#d22');

    ensurePool(settings.particleCount);
    const r = particleSize / 2;
    dots.forEach((dot, i) => {
      const el = particles[i];
      if (!dot.visible) {
        el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      el.setAttribute('cx', dot.x);
      el.setAttribute('cy', dot.y);
      el.setAttribute('r', r);
      el.setAttribute('fill', dot.fill);
      el.setAttribute('fill-opacity', dot.opacity);
    });
  }

  return { renderFrame, svg };
}

export function drawFrameToCanvas(ctx, settings, sampleResult) {
  const { frameWidth, frameHeight, backgroundColor, sceneScale, particleSize } = settings;
  const { dots } = sampleResult;
  const cx = frameWidth / 2;
  const cy = frameHeight / 2;

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, frameWidth, frameHeight);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(sceneScale, sceneScale);

  const r = particleSize / 2;
  for (const dot of dots) {
    if (!dot.visible) continue;
    ctx.globalAlpha = dot.opacity;
    ctx.fillStyle = dot.fill;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
