import { isAustraliaStoryboard, mix } from './geometry.js';

function smoothstep(u) {
  const t = Math.max(0, Math.min(1, u));
  return t * t * (3 - 2 * t);
}

function morphPhaseSpeed(t, timeline, settings, phaseSpeeds) {
  const australia = isAustraliaStoryboard(settings);

  if (!australia) {
    const { morphStart, morphEnd, morphDuration, gateTime } = timeline;
    if (t >= gateTime) {
      return phaseSpeeds.map;
    }
    if (t >= morphEnd) {
      return phaseSpeeds.map;
    }
    if (t >= morphStart && morphDuration > 0) {
      const u = (t - morphStart) / morphDuration;
      return mix(phaseSpeeds.circle, phaseSpeeds.map, u);
    }
    return phaseSpeeds.circle;
  }

  const {
    ausMorphStart,
    ausMorphEnd,
    ausMorphDuration,
    ausHoldEnd,
    waMorphEnd,
    waMorphDuration,
    gateTime
  } = timeline;

  if (t >= gateTime) {
    return phaseSpeeds.map;
  }
  if (t >= waMorphEnd) {
    return phaseSpeeds.map;
  }
  if (t >= ausHoldEnd && waMorphDuration > 0) {
    const u = (t - ausHoldEnd) / waMorphDuration;
    return mix(phaseSpeeds.aus, phaseSpeeds.map, u);
  }
  if (t >= ausMorphEnd) {
    return phaseSpeeds.aus;
  }
  if (t >= ausMorphStart && ausMorphDuration > 0) {
    const u = (t - ausMorphStart) / ausMorphDuration;
    return mix(phaseSpeeds.circle, phaseSpeeds.aus, u);
  }
  return phaseSpeeds.circle;
}

function rawTargetSpeed(t, leadRoute, ctx) {
  const { entryLength, exitRouteStart, exitLength, tailLength, phaseSpeeds, timeline, settings } =
    ctx;
  const routeEnd = exitRouteStart + exitLength;
  const tailRoute = leadRoute - tailLength;

  if (leadRoute >= routeEnd) {
    return phaseSpeeds.exit;
  }
  if (leadRoute >= exitRouteStart) {
    return phaseSpeeds.exit;
  }

  if (tailRoute < entryLength) {
    return phaseSpeeds.entry;
  }

  return morphPhaseSpeed(t, timeline, settings, phaseSpeeds);
}

function integrateMotion(ctx, stopAtLead = Infinity) {
  const dt = 1 / 240;
  const blendDur = Math.max(0, Number(ctx.settings.speedBlend) || 0);
  const samples = [{ t: 0, lead: 0 }];

  let t = 0;
  let leadRoute = 0;
  let speed = ctx.phaseSpeeds.entry;
  let blend = null;
  let lastTarget = speed;
  const maxTime = 180;

  while (t < maxTime && leadRoute < stopAtLead) {
    const target = rawTargetSpeed(t, leadRoute, ctx);

    if (Math.abs(target - lastTarget) > 0.5) {
      if (blendDur > 0) {
        blend = { from: speed, to: target, start: t, duration: blendDur };
      } else {
        speed = target;
        blend = null;
      }
      lastTarget = target;
    }

    if (blend) {
      const elapsed = t - blend.start;
      if (elapsed < blend.duration) {
        const u = elapsed / blend.duration;
        speed = blend.from + (blend.to - blend.from) * smoothstep(u);
      } else {
        speed = blend.to;
        blend = null;
      }
    }

    leadRoute += speed * dt;
    t += dt;

    const last = samples[samples.length - 1];
    if (t - last.t >= 1 / 120 || leadRoute >= stopAtLead) {
      samples.push({ t, lead: leadRoute });
    }
  }

  return { samples, endTime: t, endLead: leadRoute };
}

function leadRouteAtTime(samples, time) {
  if (time <= 0) return 0;
  const last = samples[samples.length - 1];
  if (time >= last.t) return last.lead;

  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (samples[mid].t <= time) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const span = b.t - a.t;
  if (span <= 0) return a.lead;
  const f = (time - a.t) / span;
  return a.lead + (b.lead - a.lead) * f;
}

function timeForLeadRoute(samples, targetLead) {
  if (targetLead <= 0) return 0;
  const last = samples[samples.length - 1];
  if (targetLead >= last.lead) return last.t;

  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1];
    const b = samples[i];
    if (targetLead <= b.lead) {
      const span = b.lead - a.lead;
      if (span <= 0) return b.t;
      const f = (targetLead - a.lead) / span;
      return a.t + (b.t - a.t) * f;
    }
  }
  return last.t;
}

export function createChainMotionModel(ctx) {
  const goal = ctx.routeLength + ctx.tailLength;
  const { samples, endTime, endLead } = integrateMotion(ctx, goal);
  const movementDuration =
    endLead >= goal ? timeForLeadRoute(samples, goal) : endTime;

  return {
    movementDuration,
    leadRouteAt(t) {
      return leadRouteAtTime(samples, t);
    },
    leadRouteAtGate(gateTime) {
      return leadRouteAtTime(samples, gateTime);
    },
    samples
  };
}

export function leadRouteAtWallTime(ctx, wallTime) {
  const { samples } = integrateMotion(ctx, Infinity);
  return leadRouteAtTime(samples, wallTime);
}
