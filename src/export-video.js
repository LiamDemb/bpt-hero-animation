import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  WebMOutputFormat
} from 'mediabunny';
import { drawFrameToCanvas } from './render.js';

const QUALITY_BITRATE = {
  standard: 8_000_000,
  high: 16_000_000,
  maximum: 28_000_000
};

function bitrateFor(settings) {
  const base = QUALITY_BITRATE[settings.exportQuality] || QUALITY_BITRATE.high;
  const scale = (settings.frameWidth * settings.frameHeight) / (1920 * 1080);
  return Math.round(base * scale);
}

export async function exportAnimation({
  format,
  settings,
  sampler,
  onProgress,
  shouldCancel
}) {
  const width = settings.frameWidth;
  const height = settings.frameHeight;
  const fps = settings.exportFps;
  const frameDuration = 1 / fps;
  const totalFrames = Math.max(1, Math.ceil(sampler.duration * fps));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const isMp4 = format === 'mp4';
  const outputFormat = isMp4 ? new Mp4OutputFormat() : new WebMOutputFormat();
  const codec = isMp4 ? 'avc' : 'vp9';

  const output = new Output({
    format: outputFormat,
    target: new BufferTarget()
  });

  let videoSource;
  try {
    videoSource = new CanvasSource(canvas, {
      codec,
      bitrate: bitrateFor(settings)
    });
  } catch (error) {
    if (!isMp4) {
      videoSource = new CanvasSource(canvas, {
        codec: 'vp8',
        bitrate: bitrateFor(settings)
      });
    } else {
      throw error;
    }
  }

  output.addVideoTrack(videoSource);
  await output.start();

  for (let frame = 0; frame < totalFrames; frame += 1) {
    if (shouldCancel?.()) {
      return { ok: false, cancelled: true };
    }
    const t = Math.min(frame / fps, sampler.duration);
    const sampleResult = sampler.sample(t);
    drawFrameToCanvas(ctx, settings, sampleResult);
    const timestamp = frame * frameDuration;
    await videoSource.add(timestamp, frameDuration);
    onProgress?.(frame + 1, totalFrames);
  }

  await output.finalize();
  const buffer = output.target.buffer;
  const mime = isMp4 ? 'video/mp4' : 'video/webm';
  const blob = new Blob([buffer], { type: mime });
  const ext = isMp4 ? 'mp4' : 'webm';
  return { ok: true, blob, suggestedExt: ext };
}

export function canExportFormat(format) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const codec = format === 'mp4' ? 'avc' : 'vp9';
    new CanvasSource(canvas, { codec, bitrate: 1_000_000 });
    return true;
  } catch {
    if (format === 'webm') {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        new CanvasSource(canvas, { codec: 'vp8', bitrate: 1_000_000 });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
