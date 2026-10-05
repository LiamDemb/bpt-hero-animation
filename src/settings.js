import { WA_PATH_D } from "./wa-path.js"
import { measurePathLength } from "./geometry.js"
import { normalizeEasingId } from "./easing.js"
import { SPEED_MAX, SPEED_MIN } from "./phase-speeds.js"

function defaultCircleRadius() {
    const mapLength = measurePathLength(WA_PATH_D)
    return mapLength / (2 * Math.PI)
}

export const SETTINGS_SCHEMA = {
    frameWidth: { min: 320, max: 4096, step: 10 },
    frameHeight: { min: 240, max: 4096, step: 10 },
    particleSize: { min: 2, max: 60, step: 1 },
    particleSpacing: { min: 4, max: 160, step: 1 },
    particleCount: { min: 1, max: 200, step: 1 },
    particleOpacityStart: { min: 0, max: 1, step: 0.01 },
    particleOpacityEnd: { min: 0, max: 1, step: 0.01 },
    speed: { min: SPEED_MIN, max: SPEED_MAX, step: 5 },
    entrySpeed: { min: SPEED_MIN, max: SPEED_MAX, step: 5 },
    circleSpeed: { min: SPEED_MIN, max: SPEED_MAX, step: 5 },
    mapSpeed: { min: SPEED_MIN, max: SPEED_MAX, step: 5 },
    ausSpeed: { min: SPEED_MIN, max: SPEED_MAX, step: 5 },
    exitSpeed: { min: SPEED_MIN, max: SPEED_MAX, step: 5 },
    onCircle: { min: 0, max: 10, step: 0.1 },
    morphDuration: { min: 0.1, max: 10, step: 0.1 },
    onMap: { min: 0, max: 10, step: 0.1 },
    ausMorphDuration: { min: 0.1, max: 10, step: 0.1 },
    onAus: { min: 0, max: 10, step: 0.1 },
    ausToWaDuration: { min: 0.1, max: 10, step: 0.1 },
    pauseDuration: { min: 0, max: 10, step: 0.1 },
    speedBlend: { min: 0, max: 3, step: 0.05 },
    sceneScale: { min: 0.1, max: 3, step: 0.01 },
    circleRadius: { min: 50, max: 800, step: 1 },
    mapScale: { min: 0.2, max: 3, step: 0.01 },
    ausScale: { min: 0.2, max: 3, step: 0.01 },
    morphAlignment: { min: 0, max: 100, step: 0.1 },
    ausAlign: { min: 0, max: 100, step: 0.1 },
    ausToWaAlign: { min: 0, max: 100, step: 0.1 },
    entryPointPct: { min: 0, max: 100, step: 0.1 },
    entryLength: { min: 0, max: 1500, step: 1 },
    entryAngle: { min: -180, max: 180, step: 1 },
    exitPointPct: { min: 0, max: 100, step: 0.1 },
    exitLength: { min: 0, max: 1500, step: 1 },
    exitAngle: { min: -180, max: 180, step: 1 },
    exportFps: { options: [24, 30, 60] },
}

export function createDefaultSettings() {
    return {
        frameWidth: 1920,
        frameHeight: 1080,
        backgroundColor: "#ffffff",
        particleSize: 20,
        particleSpacing: 39,
        particleCount: 40,
        particleColour: "#111111",
        particleEndColour: "#111111",
        particleOpacityStart: 1,
        particleOpacityEnd: 1,
        speed: 700,
        speedsLinked: true,
        entrySpeed: 700,
        circleSpeed: 700,
        mapSpeed: 700,
        ausSpeed: 700,
        exitSpeed: 700,
        storyboard: "wa",
        direction: 1,
        onCircle: 2.2,
        morphDuration: 1.3,
        morphEasing: "smooth",
        speedBlend: 0.4,
        onMap: 2,
        ausMorphDuration: 1.3,
        onAus: 1.8,
        ausToWaDuration: 1.3,
        pauseDuration: 1.6,
        sceneScale: 1,
        circleRadius: defaultCircleRadius(),
        mapScale: 1,
        ausScale: 1,
        morphAlignment: 0,
        ausAlign: 0,
        ausToWaAlign: 0,
        entryPointPct: 58.2,
        entryLength: 210,
        entryAngle: -25,
        exitPointPct: 21,
        exitLength: 210,
        exitAngle: -25,
        showGuides: false,
        showAnchors: false,
        showOutlines: false,
        exportFps: 60,
        exportQuality: "high",
    }
}

export function mergeSettings(partial) {
    const defaults = createDefaultSettings()
    if (!partial || typeof partial !== "object") return defaults
    const merged = { ...defaults }
    for (const key of Object.keys(defaults)) {
        if (partial[key] !== undefined && partial[key] !== null) {
            merged[key] = partial[key]
        }
    }
    merged.speed = Math.max(
        SPEED_MIN,
        Math.min(SPEED_MAX, Number(merged.speed) || SPEED_MIN),
    )
    merged.speedsLinked = merged.speedsLinked !== false
    const master = merged.speed
    merged.entrySpeed = Math.max(
        SPEED_MIN,
        Math.min(SPEED_MAX, Number(merged.entrySpeed) || master),
    )
    merged.circleSpeed = Math.max(
        SPEED_MIN,
        Math.min(SPEED_MAX, Number(merged.circleSpeed) || master),
    )
    merged.mapSpeed = Math.max(
        SPEED_MIN,
        Math.min(SPEED_MAX, Number(merged.mapSpeed) || master),
    )
    merged.ausSpeed = Math.max(
        SPEED_MIN,
        Math.min(SPEED_MAX, Number(merged.ausSpeed) || master),
    )
    merged.exitSpeed = Math.max(
        SPEED_MIN,
        Math.min(SPEED_MAX, Number(merged.exitSpeed) || master),
    )
    if (merged.speedsLinked) {
        merged.entrySpeed = master
        merged.circleSpeed = master
        merged.mapSpeed = master
        merged.ausSpeed = master
        merged.exitSpeed = master
    }
    merged.storyboard =
        merged.storyboard === "australia" ? "australia" : "wa"
    merged.direction = merged.direction === -1 ? -1 : 1
    merged.morphEasing = normalizeEasingId(merged.morphEasing ?? "smooth")
    merged.speedBlend = Math.max(
        0,
        Math.min(3, Number(merged.speedBlend ?? 0.4)),
    )
    merged.exportQuality = ["standard", "high", "maximum"].includes(
        merged.exportQuality,
    )
        ? merged.exportQuality
        : "high"
    return merged
}
