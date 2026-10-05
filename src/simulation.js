import { evaluateEasing } from './easing.js';
import { createChainMotionModel, leadRouteAtWallTime } from './chain-motion.js';
import { resolvePhaseSpeeds } from './phase-speeds.js';
import { AUS_PATH_D } from './aus-path.js';
import { WA_PATH_D } from './wa-path.js';
import {
  buildShapeContext,
  hexToRgb,
  isAustraliaStoryboard,
  lerpPoint,
  mix,
  outlineAtTime,
  outlineRouteDistance,
  pointAtPolylineDistance,
  polar,
  polylineLength
} from './geometry.js';

function getOutlineForRenderTime(renderTime, timeline, settings) {
  const outline = outlineAtTime(timeline.shapeCtx, renderTime, timeline, settings);
  return { outline, length: polylineLength(outline) };
}

function buildTimeline(settings, shapeCtx, circleEntryTime) {
  const easingId = settings.morphEasing;
  const morphEased = raw => evaluateEasing(easingId, raw);
  const australia = isAustraliaStoryboard(settings);

  if (!australia) {
    const morphStart = circleEntryTime + settings.onCircle;
    const morphEnd = morphStart + settings.morphDuration;
    const gateTime = morphEnd + settings.onMap;
    return {
      settings,
      shapeCtx,
      morphStart,
      morphEnd,
      morphDuration: settings.morphDuration,
      gateTime,
      morphEased
    };
  }

  const ausMorphStart = circleEntryTime + settings.onCircle;
  const ausMorphEnd = ausMorphStart + settings.ausMorphDuration;
  const ausHoldEnd = ausMorphEnd + settings.onAus;
  const waMorphEnd = ausHoldEnd + settings.ausToWaDuration;
  const gateTime = waMorphEnd + settings.onMap;

  return {
    settings,
    shapeCtx,
    morphStart: ausMorphStart,
    morphEnd: waMorphEnd,
    morphDuration: settings.morphDuration,
    ausMorphStart,
    ausMorphEnd,
    ausMorphDuration: settings.ausMorphDuration,
    ausHoldEnd,
    waMorphEnd,
    waMorphDuration: settings.ausToWaDuration,
    gateTime,
    morphEased
  };
}

function leaderStateFromRouteDist(routeDist, renderTime, derived, timeline) {
  const { entryLength, exitLength, entryFrac, exitFrac, exitRouteStart, settings } = derived;
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
  const { outline, length } = getOutlineForRenderTime(renderTime, timeline, settings);
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
  const { entryStart, entryAnchor, exitAnchor, exitEnd, settings } = derived;

  if (state.segment === 'entry') {
    return lerpPoint(entryStart, entryAnchor, state.entryT);
  }

  if (state.segment === 'exit') {
    return lerpPoint(exitAnchor, exitEnd, state.exitT);
  }

  if (state.segment === 'done') {
    return exitEnd;
  }

  const { outline } = getOutlineForRenderTime(renderTime, timeline, settings);
  const len = polylineLength(outline);
  const arc = state.outlineArc;
  const d = outlineRouteDistance(
    derived.entryFrac,
    arc,
    len,
    derived.outlineRefLength,
    settings.direction
  );
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
  const { settings, entryFrac, exitFrac, outlineRefLength } = derived;
  const refLength = outlineRefLength > 0 ? outlineRefLength : timeline.shapeCtx.circleLength;
  const outlineTravelAtGate = Math.max(0, leadRouteAtGate - entryLength);
  const outline = outlineAtTime(timeline.shapeCtx, gateTime, timeline, settings);
  const length = polylineLength(outline);
  const exitDist = exitFrac * length;
  const posAtGate = outlineRouteDistance(
    entryFrac,
    outlineTravelAtGate,
    length,
    refLength,
    settings.direction
  );
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

  const australia = isAustraliaStoryboard(settings);
  if (!australia) {
    if (time < timeline.morphStart) return 'Circle';
    if (time < timeline.morphEnd) return 'Morph';
    if (time < timeline.gateTime) return 'Map';
  } else {
    if (time < timeline.ausMorphStart) return 'Circle';
    if (time < timeline.ausMorphEnd) return 'Morph';
    if (time < timeline.ausHoldEnd) return 'Australia';
    if (time < timeline.waMorphEnd) return 'Morph';
    if (time < timeline.gateTime) return 'Map';
  }

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
      ...(guides.ausOutline ?? []),
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
  const shapeCtx = buildShapeContext(settings, WA_PATH_D, AUS_PATH_D);
  const phaseSpeeds = resolvePhaseSpeeds(settings);
  const entryLength = settings.entryLength;
  const exitLength = settings.exitLength;
  const tailLength = Math.max(0, (settings.particleCount - 1) * settings.particleSpacing);

  const entryOutline = shapeCtx.circlePoints;
  const entryLen0 = polylineLength(entryOutline);
  const entryFrac = settings.entryPointPct / 100;
  const exitFrac = settings.exitPointPct / 100;
  const entryAnchor = pointAtPolylineDistance(entryOutline, entryFrac * entryLen0);

  const circleEntryTime = entryLength / phaseSpeeds.entry;
  const timeline = buildTimeline(settings, shapeCtx, circleEntryTime);

  const mapOutline = outlineAtTime(shapeCtx, timeline.gateTime, timeline, settings);
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
      { settings, entryFrac, exitFrac, outlineRefLength: shapeCtx.circleLength },
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
    outlineRefLength: shapeCtx.circleLength,
    startRgb: hexToRgb(settings.particleColour),
    endRgb: hexToRgb(settings.particleEndColour)
  };

  const australia = isAustraliaStoryboard(settings);

  function sample(t) {
    const time = Math.max(0, t);
    const dots = [];
    const count = settings.particleCount;

    if (movementDuration > 0 && time >= movementDuration) {
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

    const circleOutline = outlineAtTime(shapeCtx, 0, timeline, settings);
    const mapOutlineFull = outlineAtTime(shapeCtx, timeline.gateTime, timeline, settings);
    const ausOutlineFull = australia ? shapeCtx.ausPoints : null;

    return {
      dots,
      phase: phaseName(time, derived, timeline),
      guides: {
        entryStart,
        entryAnchor,
        exitAnchor,
        exitEnd,
        circleOutline,
        mapOutline: mapOutlineFull,
        ausOutline: ausOutlineFull
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
