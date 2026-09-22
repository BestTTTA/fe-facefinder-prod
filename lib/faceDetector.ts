// Browser-side face detection (MediaPipe BlazeFace, WASM).
//
// The API searches one face per request (the dominant one), so to recognise
// several people in a frame we detect the faces here, crop each one and send
// the crops separately. Model + wasm are served from /public — no CDN at runtime.

import type { FaceDetector } from "@mediapipe/tasks-vision";

export type Box = { x1: number; y1: number; x2: number; y2: number; score: number };

/** A video frame or a still image — both can be detected in and cropped from. */
export type Media = HTMLVideoElement | HTMLImageElement;

export function mediaSize(m: Media): { w: number; h: number } {
  return m instanceof HTMLVideoElement
    ? { w: m.videoWidth, h: m.videoHeight }
    : { w: m.naturalWidth, h: m.naturalHeight };
}

let detectorPromise: Promise<FaceDetector> | null = null;

/** BlazeFace runs at 128px — a face much smaller than this in the source frame is invisible to it. */
const DETECT_WIDTH = 768;

export async function getFaceDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/mediapipe/blaze_face_short_range.tflite" },
        runningMode: "IMAGE", // frames are sampled seconds apart, so IMAGE beats VIDEO tracking
        minDetectionConfidence: 0.3,
      });
    })().catch((e) => {
      detectorPromise = null; // allow a retry on the next attempt
      throw e;
    });
  }
  return detectorPromise;
}

const work = typeof document !== "undefined" ? document.createElement("canvas") : null;

/** Detect faces inside one region of the frame, upscaled so small faces survive. */
function detectRegion(
  det: FaceDetector,
  media: Media,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): Box[] {
  if (!work) return [];
  const scale = DETECT_WIDTH / rw;
  work.width = DETECT_WIDTH;
  work.height = Math.max(1, Math.round(rh * scale));
  const ctx = work.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(media, rx, ry, rw, rh, 0, 0, work.width, work.height);

  const res = det.detect(work);
  return (res.detections ?? [])
    .map((d) => {
      const b = d.boundingBox;
      if (!b) return null;
      return {
        x1: rx + b.originX / scale,
        y1: ry + b.originY / scale,
        x2: rx + (b.originX + b.width) / scale,
        y2: ry + (b.originY + b.height) / scale,
        score: d.categories?.[0]?.score ?? 0,
      } as Box;
    })
    .filter((b): b is Box => b !== null);
}

function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter <= 0) return 0;
  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  return inter / (areaA + areaB - inter);
}

/** Non-max suppression: the same face found in overlapping tiles collapses to one box. */
function dedupe(boxes: Box[], overlap = 0.35): Box[] {
  const kept: Box[] = [];
  for (const b of [...boxes].sort((p, q) => q.score - p.score)) {
    if (!kept.some((k) => iou(k, b) > overlap)) kept.push(b);
  }
  return kept;
}

/**
 * `thorough` also scans 2x2 overlapping tiles, which finds faces that are small
 * in the full frame (people further from the camera) at ~5x the detection cost.
 */
export async function detectFaces(media: Media, thorough = true): Promise<Box[]> {
  const det = await getFaceDetector();
  const { w, h } = mediaSize(media);
  if (!w || !h) return [];

  const found: Box[] = detectRegion(det, media, 0, 0, w, h);

  if (thorough) {
    const tw = w * 0.6; // 20% overlap between neighbouring tiles
    const th = h * 0.6;
    for (const [tx, ty] of [
      [0, 0],
      [w - tw, 0],
      [0, h - th],
      [w - tw, h - th],
    ] as const) {
      found.push(...detectRegion(det, media, tx, ty, tw, th));
    }
  }

  const minSide = Math.max(20, Math.min(w, h) * 0.02);
  return dedupe(found)
    .map((b) => ({
      x1: Math.max(0, Math.round(b.x1)),
      y1: Math.max(0, Math.round(b.y1)),
      x2: Math.min(w, Math.round(b.x2)),
      y2: Math.min(h, Math.round(b.y2)),
      score: b.score,
    }))
    .filter((b) => b.x2 - b.x1 >= minSide && b.y2 - b.y1 >= minSide)
    .sort((a, b) => (b.x2 - b.x1) * (b.y2 - b.y1) - (a.x2 - a.x1) * (a.y2 - a.y1));
}

function cropRect(media: Media, box: Box, pad: number) {
  const { w, h } = mediaSize(media);
  const bw = box.x2 - box.x1;
  const bh = box.y2 - box.y1;
  const sx = Math.max(0, box.x1 - bw * pad);
  const sy = Math.max(0, box.y1 - bh * pad);
  return {
    sx,
    sy,
    sw: Math.min(w - sx, bw * (1 + pad * 2)),
    sh: Math.min(h - sy, bh * (1 + pad * 2)),
  };
}

/**
 * Crop one face out of the frame as a JPEG for /faces/search. The output keeps the
 * source pixels (no upscaling past 1.5x) so the server-side detector sees real detail.
 */
export function cropToBlob(media: Media, box: Box, { pad = 0.5, quality = 0.92 } = {}): Promise<Blob | null> {
  const { sx, sy, sw, sh } = cropRect(media, box, pad);
  const side = Math.round(Math.min(Math.max(sw, sh, 224) * 1.5, Math.max(sw, sh) * 1.5, 640));
  const c = document.createElement("canvas");
  c.width = side;
  c.height = side;
  const ctx = c.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.imageSmoothingQuality = "high";
  // letterbox into a square so the face keeps its aspect ratio
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, side, side);
  const s = Math.min(side / sw, side / sh);
  const dw = sw * s;
  const dh = sh * s;
  ctx.drawImage(media, sx, sy, sw, sh, (side - dw) / 2, (side - dh) / 2, dw, dh);
  return new Promise((res) => c.toBlob(res, "image/jpeg", quality));
}

export function cropToDataUrl(media: Media, box: Box, size = 160): string {
  const { sx, sy, sw, sh } = cropRect(media, box, 0.3);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(media, sx, sy, sw, sh, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.8);
}
