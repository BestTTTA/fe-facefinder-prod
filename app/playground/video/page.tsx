"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/Button";
import { API_URL, ApiError, apiFull, type FaceOut, type PersonOut, type SearchOut } from "@/lib/api";
import { cropToBlob, cropToDataUrl, detectFaces, getFaceDetector, mediaSize, type Box, type Media } from "@/lib/faceDetector";

const KEY_STORAGE = "ff_playground_api_key";

type Source = "file" | "webcam" | "image";

type Hit = {
  person: PersonOut;
  bestConfidence: number;
  bestSimilarity: number | null;
  count: number;
  firstAt: number;
  lastAt: number;
  thumbnail: string | null; // enrolled reference photo
  snapshot: string; // best crop from the video
};

type FrameResult = {
  at: number;
  faces: number;
  matched: string[];
  unknown: number;
  ms: number;
  error?: string;
};

// What we draw over the video for the frame currently on screen. Only recognised
// people get a box; unidentified faces are counted but not outlined.
type Drawn = { box: Box; label: string };

export default function VideoPlaygroundPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const runningRef = useRef(false);
  const inFlightRef = useRef(false);
  const thumbCache = useRef<Map<string, string | null>>(new Map());
  const drawnRef = useRef<Drawn[]>([]);

  const [apiKey, setApiKey] = useState("");
  const [source, setSource] = useState<Source>("file");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(3000);
  const [threshold, setThreshold] = useState("");
  const [maxFaces, setMaxFaces] = useState(4);
  const [thorough, setThorough] = useState(true);
  const [hits, setHits] = useState<Record<string, Hit>>({});
  const [frames, setFrames] = useState<FrameResult[]>([]);
  const [rate, setRate] = useState<{ remaining: string | null; limit: string | null }>({ remaining: null, limit: null });
  const [fatal, setFatal] = useState<string | null>(null);
  const [scanned, setScanned] = useState(0);
  const [searches, setSearches] = useState(0);
  const [detectorState, setDetectorState] = useState<"loading" | "ready" | "failed">("loading");
  const [thumbIssue, setThumbIssue] = useState<string | null>(null);
  // People counting: the latest frame, and the busiest frame of the session.
  const [frameCount, setFrameCount] = useState<{ faces: number; known: number; unknown: number } | null>(null);
  const [peak, setPeak] = useState<{ faces: number; at: number } | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY_STORAGE);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setApiKey(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  function saveKey(v: string) {
    setApiKey(v);
    thumbCache.current.clear();
    setThumbIssue(null);
    try {
      if (v) window.localStorage.setItem(KEY_STORAGE, v);
      else window.localStorage.removeItem(KEY_STORAGE);
    } catch {
      /* storage unavailable */
    }
  }

  const keyOk = apiKey.trim().length > 10;

  const getMedia = useCallback(
    (): Media | null => (source === "image" ? imageRef.current : videoRef.current),
    [source],
  );

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    if (source === "file") videoRef.current?.pause();
  }, [source]);

  /* ---------- overlay ---------- */

  const countRef = useRef(0);

  const paint = useCallback(() => {
    const m = getMedia();
    const c = overlayRef.current;
    const ctx = c?.getContext("2d");
    if (!m || !c || !ctx) return;
    const { w: mw, h: mh } = mediaSize(m);
    c.width = m.clientWidth;
    c.height = m.clientHeight;
    ctx.clearRect(0, 0, c.width, c.height);
    // the media is object-contain, so letterbox offsets must be accounted for
    const scale = Math.min(c.width / (mw || 1), c.height / (mh || 1));
    const ox = (c.width - mw * scale) / 2;
    const oy = (c.height - mh * scale) / 2;
    const sx = scale;
    const sy = scale;
    if (countRef.current > 0) {
      const label = `${countRef.current} ${countRef.current === 1 ? "person" : "people"} in frame`;
      ctx.font = "600 15px system-ui, sans-serif";
      const w = ctx.measureText(label).width + 20;
      ctx.fillStyle = "rgba(26,29,51,0.82)";
      ctx.fillRect(12, 12, w, 30);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, 22, 32);
    }

    for (const d of drawnRef.current) {
      const x = ox + d.box.x1 * sx;
      const y = oy + d.box.y1 * sy;
      const w = (d.box.x2 - d.box.x1) * sx;
      const h = (d.box.y2 - d.box.y1) * sy;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#f59209";
      ctx.strokeRect(x, y, w, h);
      ctx.font = "600 13px system-ui, sans-serif";
      const tw = ctx.measureText(d.label).width + 12;
      ctx.fillStyle = "#f59209";
      ctx.fillRect(x, Math.max(0, y - 22), tw, 20);
      ctx.fillStyle = "#fff";
      ctx.fillText(d.label, x + 6, Math.max(13, y - 8));
    }
  }, [getMedia]);

  const clearOverlay = useCallback(() => {
    drawnRef.current = [];
    countRef.current = 0;
    paint();
  }, [paint]);

  const pushFrame = useCallback((f: FrameResult) => {
    setFrames((prev) => [f, ...prev].slice(0, 40));
  }, []);

  const reset = useCallback(() => {
    setFrameCount(null);
    setPeak(null);
    thumbCache.current.clear();
    setThumbIssue(null);
    setHits({});
    setFrames([]);
    setScanned(0);
    setSearches(0);
    clearOverlay();
  }, [clearOverlay]);

  /* ---------- source ---------- */

  function stopCamera() {
    const v = videoRef.current;
    if (v) {
      (v.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
  }

  function pickFile(f: File | null) {
    if (!f) return;
    stop();
    stopCamera();
    reset();
    const isImage = f.type.startsWith("image/");
    setVideoUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return isImage ? null : URL.createObjectURL(f);
    });
    setImageUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return isImage ? URL.createObjectURL(f) : null;
    });
    setSource(isImage ? "image" : "file");
  }

  const startWebcam = useCallback(async () => {
    stop();
    reset();
    setImageUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setSource("webcam");
    setFatal(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
      const v = videoRef.current;
      if (v) {
        setVideoUrl(null);
        v.srcObject = stream;
        await v.play();
      }
    } catch {
      setFatal("Could not open the camera. Check the browser permission for this site.");
    }
  }, [reset, stop]);

  /* ---------- enrolled photo lookup ---------- */

  const referenceThumb = useCallback(
    async (personId: string): Promise<string | null> => {
      const cached = thumbCache.current.get(personId);
      if (cached !== undefined) return cached;
      try {
        const r = await apiFull<FaceOut[]>(`/api/v1/faces?person_id=${personId}&limit=1&with_urls=true`, { apiKey });
        const url = r.data[0]?.thumbnail_url ?? r.data[0]?.image_url ?? null;
        thumbCache.current.set(personId, url);
        if (!url) setThumbIssue("This person has no stored image, so no registered photo can be shown.");
        return url;
      } catch (e) {
        thumbCache.current.set(personId, null);
        if (e instanceof ApiError) {
          setThumbIssue(
            e.status === 403 || e.status === 401
              ? "Registered photos need an API key with the faces:read scope — create one in the dashboard."
              : `Could not load registered photos (${e.code}).`,
          );
        }
        return null;
      }
    },
    [apiKey],
  );

  /* ---------- scan one frame: detect N faces, search each crop ---------- */

  const scanFrame = useCallback(async () => {
    const m = getMedia();
    if (!m || inFlightRef.current) return;
    if (m instanceof HTMLVideoElement && (m.readyState < 2 || m.videoWidth === 0)) return;
    if (m instanceof HTMLImageElement && !m.complete) return;

    inFlightRef.current = true;
    const t0 = performance.now();
    const at = source === "file" && m instanceof HTMLVideoElement ? m.currentTime : Date.now() / 1000;

    try {
      let boxes: Box[];
      try {
        boxes = await detectFaces(m, thorough);
      } catch {
        setDetectorState("failed");
        stop();
        setFatal("The face detector failed to load — reload the page to try again.");
        return;
      }
      setScanned((n) => n + 1);

      if (boxes.length === 0) {
        drawnRef.current = [];
        countRef.current = 0;
        paint();
        setFrameCount({ faces: 0, known: 0, unknown: 0 });
        pushFrame({ at, faces: 0, matched: [], unknown: 0, ms: Math.round(performance.now() - t0) });
        return;
      }

      countRef.current = boxes.length;
      setFrameCount({ faces: boxes.length, known: 0, unknown: 0 });
      setPeak((p) => (p && p.faces >= boxes.length ? p : { faces: boxes.length, at }));

      const use = boxes.slice(0, maxFaces);
      const drawn: Drawn[] = [];
      const matched: string[] = [];
      const seenThisFrame = new Set<string>();
      let unknown = 0;
      let frameError: string | undefined;

      // Sequential: keeps the per-minute rate limit predictable.
      for (const box of use) {
        if (!runningRef.current) break;
        const blob = await cropToBlob(m, box);
        if (!blob) continue;
        const fd = new FormData();
        fd.append("image", blob, "face.jpg");
        if (threshold) fd.append("threshold", threshold);

        try {
          const r = await apiFull<SearchOut>("/api/v1/faces/search", { method: "POST", body: fd, apiKey });
          setRate({ remaining: r.rateLimit.remaining, limit: r.rateLimit.limit });
          setSearches((n) => n + 1);
          const d = r.data;

          if (d.match && d.person) {
            const person = d.person;
            const name = person.name ?? person.external_user_id ?? "match";
            // Two boxes on the same person (overlapping tiles) must not count twice.
            const duplicate = seenThisFrame.has(person.id);
            seenThisFrame.add(person.id);
            drawn.push({ box, label: `${name} · ${(d.confidence * 100).toFixed(0)}%` });
            if (!duplicate) matched.push(name);
            const snapshot = cropToDataUrl(m, box);
            const thumb = await referenceThumb(person.id);
            setHits((prev) => {
              const old = prev[person.id];
              const better = !old || d.confidence >= old.bestConfidence;
              return {
                ...prev,
                [person.id]: {
                  person,
                  bestConfidence: Math.max(old?.bestConfidence ?? 0, d.confidence),
                  bestSimilarity: Math.max(old?.bestSimilarity ?? 0, d.similarity ?? 0) || null,
                  count: (old?.count ?? 0) + (duplicate ? 0 : 1),
                  firstAt: old?.firstAt ?? at,
                  lastAt: at,
                  thumbnail: old?.thumbnail ?? thumb,
                  snapshot: better ? snapshot : old.snapshot,
                },
              };
            });
          } else {
            unknown += 1;
          }
        } catch (e) {
          setSearches((n) => n + 1);
          if (e instanceof ApiError) {
            if (e.code === "NO_FACE_DETECTED") {
              // The crop was too small or blurry for the server-side detector.
              unknown += 1;
            } else if (e.status === 429 || e.status === 401 || e.status === 403) {
              stop();
              setFatal(
                `${e.code}: ${e.message}${e.status === 429 ? " — raise the interval, lower max faces, or upgrade." : ""}`,
              );
              break;
            } else {
              frameError = e.code;
            }
          } else {
            stop();
            setFatal(e instanceof Error ? e.message : "Request failed");
            break;
          }
        }
        drawnRef.current = [...drawn];
        paint();
      }

      setFrameCount({ faces: boxes.length, known: seenThisFrame.size, unknown });
      pushFrame({
        at,
        faces: boxes.length,
        matched,
        unknown,
        ms: Math.round(performance.now() - t0),
        error: frameError,
      });
    } finally {
      inFlightRef.current = false;
    }
  }, [apiKey, getMedia, maxFaces, paint, pushFrame, referenceThumb, source, stop, thorough, threshold]);

  /* ---------- run loop ---------- */

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || !runningRef.current) return;
      await scanFrame();
      if (source === "image") {
        stop(); // a still image only needs one pass
        return;
      }
      if (!cancelled && runningRef.current) timer = window.setTimeout(tick, intervalMs);
    };
    let timer = window.setTimeout(tick, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [running, intervalMs, scanFrame, source, stop]);

  // Warm up the detector as soon as the page is interactive.
  useEffect(() => {
    getFaceDetector().then(
      () => setDetectorState("ready"),
      () => setDetectorState("failed"),
    );
  }, []);

  // Keep boxes aligned when the player resizes.
  useEffect(() => {
    window.addEventListener("resize", paint);
    return () => window.removeEventListener("resize", paint);
  }, [paint]);

  useEffect(
    () => () => {
      const v = videoRef.current;
      (v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  function start() {
    if (!keyOk) return;
    setFatal(null);
    runningRef.current = true;
    setRunning(true);
    if (source === "file") void videoRef.current?.play();
  }

  const detected = Object.values(hits).sort((a, b) => b.bestConfidence - a.bestConfidence);
  const worstCasePerMin = Math.round((60000 / intervalMs) * maxFaces);

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-orange">Playground</p>
          <h1 className="text-4xl font-semibold tracking-tight">Photo, video & live camera</h1>
          <p className="mt-3 text-muted">
            Load a photo, a video file or your camera. Faces are detected in your browser, then each one is
            cropped and sent to{" "}
            <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-sm">POST /faces/search</code> — so several
            people in the same photo or frame are recognised at once.{" "}
            <Link href="/playground" className="underline">Single-image playground →</Link>
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-3xl border border-line bg-surface p-5">
            <label className="text-sm font-medium" htmlFor="apikey">API key</label>
            <input
              id="apikey"
              type="password"
              value={apiKey}
              onChange={(e) => saveKey(e.target.value)}
              placeholder="fr_live_…"
              autoComplete="off"
              className="mt-2 h-11 w-full rounded-full border border-line bg-background px-4 font-mono text-sm outline-none focus:border-navy"
            />
            <p className="mt-2 text-xs text-muted">
              Needs <code className="font-mono">faces:search</code> (plus <code className="font-mono">faces:read</code>{" "}
              for enrolled photos). Each detected face costs one search from your quota.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label className="cursor-pointer">
                <span className="inline-flex h-10 items-center rounded-full border border-line bg-background px-4 text-sm hover:border-navy">
                  Choose photo or video
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/*"
                  className="sr-only"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <Button variant="outline" onClick={() => void startWebcam()}>Use camera</Button>
              <span className="text-xs text-muted">
                {detectorState === "loading" && "Loading face detector…"}
                {detectorState === "ready" && "Face detector ready"}
                {detectorState === "failed" && <span className="text-red-600">Face detector failed to load</span>}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-surface p-5">
            <p className="text-sm font-medium">Scan settings</p>
            {source !== "image" && (
              <label className="mt-3 block">
                <span className="mb-1 flex justify-between font-mono text-xs text-muted">
                  <span>interval</span>
                  <span>{(intervalMs / 1000).toFixed(1)}s</span>
                </span>
                <input
                  type="range"
                  min={500}
                  max={10000}
                  step={500}
                  value={intervalMs}
                  onChange={(e) => setIntervalMs(Number(e.target.value))}
                  className="w-full accent-orange"
                />
              </label>
            )}
            <label className="mt-3 block">
              <span className="mb-1 flex justify-between font-mono text-xs text-muted">
                <span>max faces / frame</span>
                <span>{maxFaces}</span>
              </span>
              <input
                type="range"
                min={1}
                max={source === "image" ? 25 : 10}
                step={1}
                value={maxFaces}
                onChange={(e) => setMaxFaces(Number(e.target.value))}
                className="w-full accent-orange"
              />
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={thorough}
                onChange={(e) => setThorough(e.target.checked)}
                className="mt-1 accent-orange"
              />
              <span>
                Thorough scan
                <span className="block text-xs text-muted">
                  Also scans 4 overlapping tiles so faces further from the camera are found. Slower per frame, same
                  number of API calls.
                </span>
              </span>
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block font-mono text-xs text-muted">threshold (optional)</span>
              <input
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="server default (0.45)"
                inputMode="decimal"
                className="h-10 w-full rounded-full border border-line bg-background px-4 text-sm outline-none focus:border-navy"
              />
            </label>
            <div className="mt-4 flex gap-2">
              {running ? (
                <Button variant="dark" className="flex-1" onClick={stop}>Stop</Button>
              ) : (
                <Button
                  className="flex-1"
                  disabled={!keyOk || detectorState === "failed" || (source === "image" && !imageUrl)}
                  onClick={start}
                >
                  {source === "image" ? "Scan photo" : "Start scanning"}
                </Button>
              )}
              <Button variant="outline" onClick={reset} disabled={running}>Clear</Button>
            </div>
            {source !== "image" && worstCasePerMin > 10 && (
              <p className="mt-1 text-xs text-amber-700">
                Up to ~{worstCasePerMin} searches/min with a full frame. The Free package allows 10/min.
              </p>
            )}
          </div>
        </div>

        {fatal && (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{fatal}</p>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Count
            label="People in frame"
            value={frameCount ? frameCount.faces : "—"}
            hint={
              frameCount && frameCount.faces > maxFaces
                ? `only ${maxFaces} searched`
                : frameCount && frameCount.faces > 0
                  ? `${frameCount.known} known · ${frameCount.unknown} unknown`
                  : undefined
            }
            live={running}
          />
          <Count
            label="Busiest frame"
            value={peak ? peak.faces : "—"}
            hint={peak && source === "file" ? `at ${fmtClock(peak.at)}` : undefined}
          />
          <Count label="People identified" value={detected.length} hint="unique, whole session" />
          <Count
            label="Frames · searches"
            value={`${scanned} · ${searches}`}
            hint={rate.limit ? `rate ${rate.remaining}/${rate.limit} per min` : undefined}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="relative overflow-hidden rounded-3xl border border-line bg-navy">
              {source === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  ref={imageRef}
                  src={imageUrl ?? undefined}
                  alt="Photo being scanned"
                  onLoad={paint}
                  className="block max-h-[420px] w-full bg-black object-contain"
                />
              ) : (
                <video
                  ref={videoRef}
                  src={videoUrl ?? undefined}
                  controls={source === "file"}
                  muted
                  playsInline
                  onEnded={stop}
                  onLoadedMetadata={paint}
                  className="block max-h-[420px] w-full bg-black object-contain"
                />
              )}
              <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
              {!videoUrl && source === "file" && (
                <div className="absolute inset-0 grid place-items-center text-sm text-white/60">
                  Choose a photo or video file, or use the camera
                </div>
              )}
              {running && (
                <span className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-orange" /> scanning
                </span>
              )}
            </div>

            <div className="mt-4 rounded-3xl border border-line bg-surface p-4">
              <p className="mb-2 text-sm font-medium">{source === "image" ? "Scan log" : "Frame log"}</p>
              {frames.length === 0 ? (
                <p className="text-sm text-muted">Nothing scanned yet.</p>
              ) : (
                <ul className="max-h-52 space-y-1 overflow-y-auto text-sm">
                  {frames.map((f, i) => (
                    <li key={i} className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 items-start gap-2">
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                            f.error ? "bg-red-500" : f.matched.length ? "bg-emerald-500" : "bg-black/20"
                          }`}
                        />
                        <span className="min-w-0">
                          {f.faces === 0 ? (
                            <span className="text-muted">No face found</span>
                          ) : (
                            <>
                              <span className="text-muted">{f.faces} face{f.faces === 1 ? "" : "s"}: </span>
                              {f.matched.length > 0 && <span className="font-medium">{f.matched.join(", ")}</span>}
                              {f.matched.length > 0 && f.unknown > 0 && <span className="text-muted">, </span>}
                              {f.unknown > 0 && <span className="text-muted">{f.unknown} unknown</span>}
                              {f.error && <span className="text-red-600"> · {f.error}</span>}
                            </>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted">
                        {source === "file" ? fmtClock(f.at) : ""} {f.ms}ms
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium">
              People detected {detected.length > 0 && <span className="text-muted">({detected.length})</span>}
            </p>
            {thumbIssue && detected.length > 0 && (
              <p className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {thumbIssue}
              </p>
            )}
            {detected.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-line p-8 text-center text-sm text-muted">
                Matches appear here with the person&apos;s enrolled photo and metadata.
              </p>
            ) : (
              <ul className="space-y-3">
                {detected.map((h) => (
                  <li key={h.person.id} className="rounded-3xl border border-line bg-surface p-4">
                    <div className="flex gap-3">
                      <div className="flex shrink-0 gap-2">
                        <Figure
                          src={h.thumbnail}
                          caption="Registered"
                          alt={`Registered photo of ${h.person.name ?? "this person"}`}
                        />
                        <Figure
                          src={h.snapshot || null}
                          caption="Detected"
                          alt={`Detected face of ${h.person.name ?? "this person"}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{h.person.name ?? "(no name)"}</p>
                        {h.person.external_user_id && (
                          <p className="truncate font-mono text-xs text-muted">{h.person.external_user_id}</p>
                        )}
                        <p className="mt-1 text-xs">
                          <span className="font-medium text-emerald-700">{(h.bestConfidence * 100).toFixed(1)}%</span>
                          <span className="text-muted">
                            {" "}confidence · sim {h.bestSimilarity?.toFixed(3) ?? "—"} · seen {h.count}×
                          </span>
                        </p>
                        {source === "file" && (
                          <p className="text-xs text-muted">{fmtClock(h.firstAt)} → {fmtClock(h.lastAt)}</p>
                        )}
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                      {(["email", "phone", "company", "department"] as const).map((k) =>
                        h.person[k] ? (
                          <div key={k} className="contents">
                            <dt className="text-muted">{k}</dt>
                            <dd className="truncate">{h.person[k]}</dd>
                          </div>
                        ) : null,
                      )}
                      {Object.entries(h.person.metadata ?? {}).map(([k, v]) => (
                        <div key={k} className="contents">
                          <dt className="font-mono text-muted">{k}</dt>
                          <dd className="truncate">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p className="mt-8 text-xs text-muted">
          API: <span className="font-mono">{API_URL}</span> · the backend searches one face per request, so this page
          detects faces locally (MediaPipe BlazeFace, served from this site) and sends one crop per face.
        </p>
      </main>
      <Footer />
    </>
  );
}

/** A single counter tile. */
function Count({
  label,
  value,
  hint,
  live = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  live?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange" />}
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] text-muted">{hint ?? " "}</p>
    </div>
  );
}

/** One labelled picture: the registered reference photo, or the crop we detected. */
function Figure({ src, caption, alt }: { src: string | null; caption: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  const show = src && !broken;
  return (
    <figure className="w-20">
      <div className="h-20 w-20 overflow-hidden rounded-xl border border-line bg-black/5">
        {show ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} onError={() => setBroken(true)} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center px-1 text-center text-[10px] leading-tight text-muted">
            {broken ? "image expired" : "not available"}
          </span>
        )}
      </div>
      <figcaption className="mt-1 text-center text-[11px] text-muted">{caption}</figcaption>
    </figure>
  );
}

function fmtClock(sec: number) {
  if (!Number.isFinite(sec)) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
