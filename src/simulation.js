import { evaluateEasing } from './easing.js';
import { createChainMotionModel, leadRouteAtWallTime } from './chain-motion.js';
import { resolvePhaseSpeeds } from './phase-speeds.js';
import { WA_PATH_D } from './wa-path.js';
import {
  buildShapeContext,
  hexToRgb,
  lerpPoint,
  mix,
  outlineAtTime,
  pointAtPolylineDistance,
  polar,
  polylineLength
} from './geometry.js';

function morphProgressAt(renderTime, timeline) {
  const { morphStart, morphDuration, settings } = timeline;
  if (renderTime < morphStart) return 0;
  const raw = (renderTime - morphStart) / Math.max(morphDuration, 0.001);
  return evaluateEasing(settings.morphEasing, raw);
}

function getOutlineForRenderTime(renderTime, timeline) {
  const morphT = morphProgressAt(renderTime, timeline);
  const outline = outlineAtTime(timeline.shapeCtx, morphT);
  return { outline, length: polylineLength(outline) };
}

function buildTimeline(settings, shapeCtx, circleEntryTime) {
  const morphStart = circleEntryTime + settings.onCircle;
  const morphEnd = morphStart + settings.morphDuration;
  const gateTime = morphEnd + settings.onMap;
  return {
    settings,
    shapeCtx,
    morphStart,
    morphEnd,
    morphDuration: settings.morphDuration,
    gateTime
  };
}

function leaderStateFromRouteDist(routeDist, renderTime, derived, timeline) {
  const { entryLength, exitLength, entryFrac, exitFrac, exitRouteStart } = derived;
  const dist = routeDist;

  if (dist <= 0) {
    return { segment: 'entry', entryT: 0, outlineArc: 0, exitT: 0, onOutline: false };
  }

  if (dist < entryLength) {
    return {
      segment: 'entry',
      entryT: entryLength > 0 ? dist / entryLength : 1,
      outlineArc: 0,
      exitT: 0,
      onOutline: false
    };
  }

  const outlineTravel = dist - entryLength;
  const { outline, length } = getOutlineForRenderTime(renderTime, timeline);
  const entryPointDist = entryFrac * length;
  const exitPointDist = exitFrac * length;
  const travelToExit = derived.outlineExitThreshold;

  if (outlineTravel < travelToExit) {
    return {
      segment: 'outline',
      entryT: 1,
      outlineArc: outlineTravel,
      exitT: 0,
      onOutline: true,
      outline,
      outlineLength: length,
      entryPointDist,
      exitPointDist
    };
  }

  const exitDist = dist - exitRouteStart;
  if (exitLength > 0 && exitDist <= exitLength) {
    return {
      segment: 'exit',
      entryT: 1,
      outlineArc: travelToExit,
      exitT: exitLength > 0 ? Math.min(1, exitDist / exitLength) : 1,
      onOutline: false,
      outline,
      outlineLength: length,
      entryPointDist,
      exitPointDist
    };
  }

  return {
    segment: 'done',
    entryT: 1,
    outlineArc: travelToExit,
    exitT: 1,
    onOutline: false
  };
}

function pointFromLeaderState(state, derived, timeline, renderTime) {
  const { entryStart, entryAnchor, exitAnchor, exitEnd } = derived;

  if (state.segment === 'entry') {
    return lerpPoint(entryStart, entryAnchor, state.entryT);
  }

  if (state.segment === 'exit') {
    return lerpPoint(exitAnchor, exitEnd, state.exitT);
  }

  if (state.segment === 'done') {
    return exitEnd;
  }

  const { outline } = getOutlineForRenderTime(renderTime, timeline);
  const len = polylineLength(outline);
  const entryDist = derived.entryFrac * len;
  const arc = state.outlineArc;
  const dir = derived.settings.direction;
  const d = dir === 1 ? entryDist + arc : entryDist - arc;
  return pointAtPolylineDistance(outline, d);
}

function forwardArcBetween(entryDist, exitDist, length, direction) {
  if (direction === 1) {
    let delta = exitDist - entryDist;
    if (delta < 0) delta += length;
    return delta;
  }
  let delta = entryDist - exitDist;
  if (delta < 0) delta += length;
  return delta;
}

function outlineExitThresholdAtGate(leadRouteAtGate, entryLength, gateTime, derived, timeline) {
  const { settings, entryFrac, exitFrac } = derived;
  const outlineTravelAtGate = Math.max(0, leadRouteAtGate - entryLength);
  const morphT = morphProgressAt(gateTime, timeline);
  const outline = outlineAtTime(timeline.shapeCtx, morphT);
  const length = polylineLength(outline);
  const entryDist = entryFrac * length;
  const exitDist = exitFrac * length;
  const posAtGate =
    settings.direction === 1 ? entryDist + outlineTravelAtGate : entryDist - outlineTravelAtGate;
  const normalized = ((posAtGate % length) + length) % length;
  const remaining = forwardArcBetween(normalized, exitDist, length, settings.direction);
  return outlineTravelAtGate + remaining;
}

function particleAppearance(index, derived) {
  const { settings, startRgb, endRgb } = derived;
  const count = settings.particleCount;
  const t = count <= 1 ? 0 : index / (count - 1);
  return {
    fill: `rgb(${Math.round(mix(startRgb.r, endRgb.r, t))}, ${Math.round(mix(startRgb.g, endRgb.g, t))}, ${Math.round(mix(startRgb.b, endRgb.b, t))})`,
    opacity: mix(settings.particleOpacityStart, settings.particleOpacityEnd, t)
  };
}

function phaseName(time, derived, timeline) {
  const { settings, movementDuration } = derived;
  if (time >= movementDuration) return 'Pause';
  const lead = derived.motion.leadRouteAt(time);
  const tailRoute = lead - derived.tailLength;
  if (tailRoute < settings.entryLength) return 'Entry';
  if (time < timeline.morphStart) return 'Circle';
  if (time < timeline.morphEnd) return 'Morph';
  if (time < timeline.gateTime) return 'Map';
  const state = leaderStateFromRouteDist(lead, time, derived, timeline);
  if (state.segment === 'exit' || state.segment === 'done') return 'Exit';
  return 'To exit';
}

export function computeFitSceneScale(settings) {
  const sampler = createSampler({ ...settings, sceneScale: 1 });
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const times = [0, sampler.movementDuration * 0.35, sampler.movementDuration * 0.7];
  for (const t of times) {
    const { guides } = sampler.sample(t);
    const pts = [
      ...guides.circleOutline,
      ...guides.mapOutline,
      guides.entryStart,
      guides.entryAnchor,
      guides.exitAnchor,
      guides.exitEnd
    ];
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }
  const margin = settings.particleSize * 4 + 48;
  const w = maxX - minX + margin * 2;
  const h = maxY - minY + margin * 2;
  const scale = Math.min(settings.frameWidth / w, settings.frameHeight / h);
  return Math.min(3, Math.max(0.1, scale));
}

export function createSampler(settings) {
  const shapeCtx = buildShapeContext(settings, WA_PATH_D);
  const phaseSpeeds = resolvePhaseSpeeds(settings);
  const entryLength = settings.entryLength;
  const exitLength = settings.exitLength;
  const tailLength = Math.max(0, (settings.particleCount - 1) * settings.particleSpacing);

  const entryOutline = outlineAtTime(shapeCtx, 0);
  const entryLen0 = polylineLength(entryOutline);
  const entryFrac = settings.entryPointPct / 100;
  const exitFrac = settings.exitPointPct / 100;
  const entryAnchor = pointAtPolylineDistance(entryOutline, entryFrac * entryLen0);

  const mapOutline = outlineAtTime(shapeCtx, 1);
  const mapLen = polylineLength(mapOutline);
  const exitAnchor = pointAtPolylineDistance(mapOutline, exitFrac * mapLen);

  const entryVector = polar(settings.entryAngle, entryLength);
  const exitVector = polar(settings.exitAngle, exitLength);
  const entryStart = {
    x: entryAnchor.x + entryVector.x,
    y: entryAnchor.y + entryVector.y
  };
  const exitEnd = {
    x: exitAnchor.x + exitVector.x,
    y: exitAnchor.y + exitVector.y
  };

  const circleEntryTime = entryLength / phaseSpeeds.entry;
  const timeline = buildTimeline(settings, shapeCtx, circleEntryTime);

  let exitRouteStart = entryLength + 2000;
  let outlineExitThreshold = 0;
  let motion = null;
  let routeLength = 0;

  for (let i = 0; i < 6; i += 1) {
    routeLength = exitRouteStart + exitLength;
    const motionCtx = {
      settings,
      phaseSpeeds,
      entryLength,
      exitLength,
      exitRouteStart,
      routeLength,
      tailLength,
      timeline
    };
    const leadAtGate = leadRouteAtWallTime(motionCtx, timeline.gateTime);
    outlineExitThreshold = outlineExitThresholdAtGate(
      leadAtGate,
      entryLength,
      timeline.gateTime,
      { settings, entryFrac, exitFrac },
      timeline
    );
    const nextStart = entryLength + outlineExitThreshold;
    if (Math.abs(nextStart - exitRouteStart) < 0.5) {
      exitRouteStart = nextStart;
      break;
    }
    exitRouteStart = nextStart;
  }

  routeLength = exitRouteStart + exitLength;
  const motionCtx = {
    settings,
    phaseSpeeds,
    entryLength,
    exitLength,
    exitRouteStart,
    routeLength,
    tailLength,
    timeline
  };
  motion = createChainMotionModel(motionCtx);
  const movementDuration = motion.movementDuration;
  const duration = movementDuration + settings.pauseDuration;

  const derived = {
    settings,
    shapeCtx,
    phaseSpeeds,
    entryLength,
    exitLength,
    entryFrac,
    exitFrac,
    circleEntryTime,
    entryStart,
    entryAnchor,
    exitAnchor,
    exitEnd,
    gateTime: timeline.gateTime,
    outlineExitThreshold,
    exitRouteStart,
    routeLength,
    tailLength,
    movementDuration,
    duration,
    timeline,
    motion,
    startRgb: hexToRgb(settings.particleColour),
    endRgb: hexToRgb(settings.particleEndColour)
  };

  function sample(t) {
    const time = Math.max(0, t);
    const dots = [];
    const count = settings.particleCount;

    if (time >= movementDuration) {
      for (let i = 0; i < count; i += 1) {
        dots.push({ x: 0, y: 0, visible: false, fill: '#000', opacity: 0 });
      }
    } else {
      const leadDist = motion.leadRouteAt(time);
      for (let i = 0; i < count; i += 1) {
        const routePos = leadDist - i * settings.particleSpacing;
        if (routePos < 0 || routePos > routeLength) {
          dots.push({ x: 0, y: 0, visible: false, fill: '#000', opacity: 0 });
          continue;
        }
        const state = leaderStateFromRouteDist(routePos, time, derived, timeline);
        const point = pointFromLeaderState(state, derived, timeline, time);
        const appearance = particleAppearance(i, derived);
        dots.push({
          x: point.x,
          y: point.y,
          visible: true,
          fill: appearance.fill,
          opacity: appearance.opacity
        });
      }
    }

    const circleOutline = outlineAtTime(shapeCtx, 0);
    const mapOutlineFull = outlineAtTime(shapeCtx, 1);

    return {
      dots,
      phase: phaseName(time, derived, timeline),
      guides: {
        entryStart,
        entryAnchor,
        exitAnchor,
        exitEnd,
        circleOutline,
        mapOutline: mapOutlineFull
      },
      movementDuration,
      duration
    };
  }

  return {
    duration,
    movementDuration,
    routeLength,
    sample,
    derived
  };
}
