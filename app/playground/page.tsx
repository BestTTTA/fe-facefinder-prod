"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/Button";
import {
  API_URL,
  ApiError,
  apiFull,
  type ApiResult,
  type FaceOut,
  type PersonOut,
  type SearchOut,
  type UploadOut,
} from "@/lib/api";

const KEY_STORAGE = "ff_playground_api_key";
type Tab = "register" | "search" | "persons";

type Outcome =
  | { kind: "ok"; result: ApiResult<unknown> }
  | { kind: "error"; error: ApiError };

export default function PlaygroundPage() {
  const [apiKey, setApiKey] = useState("");
  const [tab, setTab] = useState<Tab>("register");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY_STORAGE);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setApiKey(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  function updateKey(v: string) {
    setApiKey(v);
    try {
      if (v) window.localStorage.setItem(KEY_STORAGE, v);
      else window.localStorage.removeItem(KEY_STORAGE);
    } catch {
      /* storage unavailable */
    }
  }

  const keyOk = apiKey.trim().length > 10;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-orange">
            Playground
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Try the API with your key</h1>
          <p className="mt-3 text-muted">
            Requests go straight from your browser to{" "}
            <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-sm">{API_URL}</code>{" "}
            using <code className="font-mono text-sm">X-API-Key</code>. Uploads and searches here count
            against your quota.
          </p>
        </div>

        {/* API key */}
        <div className="mt-8 rounded-3xl border border-line bg-surface p-5">
          <label className="text-sm font-medium" htmlFor="apikey">
            API key
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="apikey"
              type="password"
              value={apiKey}
              onChange={(e) => updateKey(e.target.value)}
              placeholder="fr_live_…"
              autoComplete="off"
              className="h-11 flex-1 rounded-full border border-line bg-background px-4 font-mono text-sm outline-none focus:border-navy"
            />
            <Button variant="outline" onClick={() => updateKey("")} disabled={!apiKey}>
              Clear
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Create one in the <Link href="/dashboard" className="underline">dashboard</Link>. Register
            needs <code className="font-mono">faces:upload</code>, Search needs{" "}
            <code className="font-mono">faces:search</code>, Persons needs{" "}
            <code className="font-mono">persons:read</code>. Stored only in this browser.
          </p>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex gap-1 rounded-full border border-line bg-surface p-1 sm:w-fit">
          {(
            [
              ["register", "Register face"],
              ["search", "Search face"],
              ["persons", "Persons"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors sm:flex-none ${
                tab === id ? "bg-navy text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
          <Link
            href="/playground/video"
            className="flex-1 rounded-full px-4 py-2 text-center text-sm font-medium text-muted transition-colors hover:text-foreground sm:flex-none"
          >
            Photo, video & camera →
          </Link>
        </div>

        <div className="mt-6">
          {tab === "register" && <RegisterPanel apiKey={apiKey} keyOk={keyOk} />}
          {tab === "search" && <SearchPanel apiKey={apiKey} keyOk={keyOk} />}
          {tab === "persons" && <PersonsPanel apiKey={apiKey} keyOk={keyOk} />}
        </div>
      </main>
      <Footer />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Register                                                            */
/* ------------------------------------------------------------------ */

function RegisterPanel({ apiKey, keyOk }: { apiKey: string; keyOk: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState({
    external_user_id: "",
    name: "",
    email: "",
    phone: "",
    company: "",
    department: "",
  });
  const [metadata, setMetadata] = useState('{\n  "position": "Engineer"\n}');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Outcome | null>(null);

  const metaError = useMemo(() => {
    if (!metadata.trim()) return null;
    try {
      const v = JSON.parse(metadata);
      return v && typeof v === "object" && !Array.isArray(v) ? null : "metadata must be a JSON object";
    } catch {
      return "metadata is not valid JSON";
    }
  }, [metadata]);

  const curl = useMemo(() => {
    const parts = [
      `curl -X POST ${API_URL}/api/v1/faces`,
      `  -H "X-API-Key: fr_live_…"`,
      `  -F image=@${file?.name ?? "photo.jpg"}`,
    ];
    for (const [k, v] of Object.entries(fields)) if (v) parts.push(`  -F ${k}="${v}"`);
    if (metadata.trim()) parts.push(`  -F metadata='${metadata.replace(/\s+/g, " ")}'`);
    return parts.join(" \\\n");
  }, [file, fields, metadata]);

  async function submit() {
    if (!file) return;
    setBusy(true);
    setOut(null);
    const fd = new FormData();
    fd.append("image", file);
    for (const [k, v] of Object.entries(fields)) if (v) fd.append(k, v);
    if (metadata.trim()) fd.append("metadata", metadata);
    try {
      const result = await apiFull<UploadOut>("/api/v1/faces", { method: "POST", body: fd, apiKey });
      setOut({ kind: "ok", result });
    } catch (e) {
      setOut({ kind: "error", error: toApiError(e) });
    } finally {
      setBusy(false);
    }
  }

  const upload = out?.kind === "ok" ? (out.result.data as UploadOut) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Request" subtitle="POST /api/v1/faces">
        <ImagePicker file={file} onChange={setFile} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(Object.keys(fields) as (keyof typeof fields)[]).map((k) => (
            <Field key={k} label={k}>
              <input
                value={fields[k]}
                onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
                placeholder={k === "external_user_id" ? "EMP-001" : ""}
                className={inputCls}
              />
            </Field>
          ))}
        </div>
        <Field label="metadata (JSON object)" className="mt-3" error={metaError ?? undefined}>
          <textarea
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
            rows={4}
            spellCheck={false}
            className={`${inputCls} h-auto rounded-2xl py-2 font-mono`}
          />
        </Field>
        <Button
          className="mt-4 w-full"
          disabled={!keyOk || !file || !!metaError || busy}
          onClick={() => void submit()}
        >
          {busy ? "Registering…" : "Register face"}
        </Button>
        {!keyOk && <Hint>Enter an API key above first.</Hint>}
        <Code className="mt-4">{curl}</Code>
      </Panel>

      <Panel title="Response">
        {!out && <Empty>Submit a photo to see the response here.</Empty>}
        {out?.kind === "error" && <ErrorBox error={out.error} />}
        {out?.kind === "ok" && upload && (
          <>
            <ResultMeta result={out.result} />
            <div className="mt-4 flex gap-4 rounded-2xl border border-line bg-background p-4">
              {upload.face.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={upload.face.thumbnail_url}
                  alt="Registered face thumbnail"
                  className="h-20 w-20 rounded-xl object-cover"
                />
              )}
              <div className="min-w-0 text-sm">
                <p className="font-semibold">{upload.person.name ?? "(no name)"}</p>
                <p className="font-mono text-xs text-muted">
                  person {short(upload.person.id)} · face {short(upload.face.id)}
                </p>
                <p className="mt-1 text-muted">
                  {upload.image.width}×{upload.image.height} · det_score{" "}
                  {upload.face.det_score?.toFixed(3) ?? "—"} · {upload.processing_time_ms} ms
                </p>
              </div>
            </div>
            <Json value={out.result.data} />
          </>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

function SearchPanel({ apiKey, keyOk }: { apiKey: string; keyOk: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [threshold, setThreshold] = useState("");
  const [topK, setTopK] = useState("5");
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Outcome | null>(null);

  async function submit() {
    if (!file) return;
    setBusy(true);
    setOut(null);
    const fd = new FormData();
    fd.append("image", file);
    if (threshold) fd.append("threshold", threshold);
    if (topK) fd.append("top_k", topK);
    try {
      const result = await apiFull<SearchOut>("/api/v1/faces/search", { method: "POST", body: fd, apiKey });
      setOut({ kind: "ok", result });
    } catch (e) {
      setOut({ kind: "error", error: toApiError(e) });
    } finally {
      setBusy(false);
    }
  }

  const res = out?.kind === "ok" ? (out.result.data as SearchOut) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Request" subtitle="POST /api/v1/faces/search">
        <ImagePicker file={file} onChange={setFile} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="threshold (0–1, optional)">
            <input
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="server default (0.45)"
              inputMode="decimal"
              className={inputCls}
            />
          </Field>
          <Field label="top_k (1–50)">
            <input
              value={topK}
              onChange={(e) => setTopK(e.target.value)}
              inputMode="numeric"
              className={inputCls}
            />
          </Field>
        </div>
        <Button className="mt-4 w-full" disabled={!keyOk || !file || busy} onClick={() => void submit()}>
          {busy ? "Searching…" : "Search face"}
        </Button>
        {!keyOk && <Hint>Enter an API key above first.</Hint>}
        <Code className="mt-4">{`curl -X POST ${API_URL}/api/v1/faces/search \\
  -H "X-API-Key: fr_live_…" \\
  -F image=@${file?.name ?? "query.jpg"}${threshold ? ` \\\n  -F threshold=${threshold}` : ""}${topK ? ` \\\n  -F top_k=${topK}` : ""}`}</Code>
      </Panel>

      <Panel title="Response">
        {!out && <Empty>Submit a query photo to see the match here.</Empty>}
        {out?.kind === "error" && <ErrorBox error={out.error} />}
        {out?.kind === "ok" && res && (
          <>
            <ResultMeta result={out.result} />
            <div
              className={`mt-4 rounded-2xl border p-4 ${
                res.match ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-lg font-semibold ${res.match ? "text-emerald-700" : "text-amber-700"}`}>
                  {res.match ? "Match found" : "No match"}
                </span>
                <span className="text-sm text-muted">{res.processing_time_ms} ms</span>
              </div>
              {res.person && (
                <p className="mt-1 text-sm">
                  <span className="font-medium">{res.person.name ?? "(no name)"}</span>
                  {res.person.external_user_id && (
                    <span className="font-mono text-muted"> · {res.person.external_user_id}</span>
                  )}
                </p>
              )}
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <Stat label="confidence" value={pct(res.confidence)} />
                <Stat label="similarity" value={res.similarity != null ? res.similarity.toFixed(4) : "—"} />
                <Stat label="threshold" value={res.threshold.toFixed(2)} />
              </div>
              {res.person && Object.keys(res.person.metadata ?? {}).length > 0 && (
                <div className="mt-3 text-xs">
                  <p className="mb-1 font-medium text-muted">metadata</p>
                  <Json value={res.person.metadata} compact />
                </div>
              )}
            </div>
            {res.candidates.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium">Candidates ({res.candidates.length})</p>
                <ul className="divide-y divide-line rounded-2xl border border-line text-sm">
                  {res.candidates.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-4 py-2">
                      <span className="truncate">
                        {String(c.name ?? c.external_user_id ?? c.person_id ?? c.id ?? `#${i + 1}`)}
                      </span>
                      <span className="font-mono text-xs text-muted">
                        {typeof c.similarity === "number" ? c.similarity.toFixed(4) : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Json value={out.result.data} />
          </>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Persons                                                             */
/* ------------------------------------------------------------------ */

function PersonsPanel({ apiKey, keyOk }: { apiKey: string; keyOk: boolean }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [persons, setPersons] = useState<PersonOut[] | null>(null);
  const [err, setErr] = useState<ApiError | null>(null);
  const [selected, setSelected] = useState<PersonOut | null>(null);
  const [faces, setFaces] = useState<FaceOut[] | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    setSelected(null);
    setFaces(null);
    try {
      const qs = new URLSearchParams({ limit: "50" });
      if (q) qs.set("q", q);
      const r = await apiFull<PersonOut[]>(`/api/v1/persons?${qs}`, { apiKey });
      setPersons(r.data);
    } catch (e) {
      setErr(toApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function openPerson(p: PersonOut) {
    setSelected(p);
    setFaces(null);
    try {
      const r = await apiFull<FaceOut[]>(`/api/v1/faces?person_id=${p.id}&with_urls=true`, { apiKey });
      setFaces(r.data);
    } catch (e) {
      setErr(toApiError(e));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Persons" subtitle="GET /api/v1/persons">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && keyOk && void load()}
            placeholder="Search by name / external id"
            className={inputCls}
          />
          <Button variant="dark" disabled={!keyOk || busy} onClick={() => void load()}>
            {busy ? "Loading…" : "Load"}
          </Button>
        </div>
        {!keyOk && <Hint>Enter an API key above first.</Hint>}
        {err && <ErrorBox error={err} className="mt-4" />}
        {persons && (
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
            {persons.length === 0 && <li className="p-4 text-sm text-muted">No persons yet.</li>}
            {persons.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => void openPerson(p)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-black/[0.03] ${
                    selected?.id === p.id ? "bg-black/[0.04]" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="font-medium">{p.name ?? "(no name)"}</span>
                    {p.external_user_id && (
                      <span className="ml-2 font-mono text-xs text-muted">{p.external_user_id}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {p.face_count != null ? `${p.face_count} face${p.face_count === 1 ? "" : "s"}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Detail" subtitle={selected ? `GET /api/v1/faces?person_id=${short(selected.id)}&with_urls=true` : undefined}>
        {!selected && <Empty>Select a person to see their faces and metadata.</Empty>}
        {selected && (
          <>
            <div className="text-sm">
              <p className="text-lg font-semibold">{selected.name ?? "(no name)"}</p>
              <p className="font-mono text-xs text-muted">{selected.id}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {(["external_user_id", "email", "phone", "company", "department"] as const).map((k) =>
                  selected[k] ? (
                    <div key={k} className="contents">
                      <dt className="text-muted">{k}</dt>
                      <dd className="truncate">{selected[k]}</dd>
                    </div>
                  ) : null,
                )}
              </dl>
            </div>
            {faces === null ? (
              <p className="mt-4 text-sm text-muted">Loading faces…</p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {faces.length === 0 && <p className="text-sm text-muted">No faces.</p>}
                {faces.map((f) =>
                  f.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={f.id}
                      src={f.thumbnail_url}
                      alt=""
                      title={`det_score ${f.det_score?.toFixed(3) ?? "—"}`}
                      className="h-20 w-20 rounded-xl border border-line object-cover"
                    />
                  ) : (
                    <span key={f.id} className="grid h-20 w-20 place-items-center rounded-xl border border-line font-mono text-[10px] text-muted">
                      {short(f.id)}
                    </span>
                  ),
                )}
              </div>
            )}
            <Json value={{ ...selected, faces: faces ?? undefined }} />
          </>
        )}
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* shared bits                                                         */
/* ------------------------------------------------------------------ */

const inputCls =
  "h-10 w-full rounded-full border border-line bg-background px-4 text-sm outline-none focus:border-navy";

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <span className="truncate font-mono text-xs text-muted">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  className = "",
  error,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  error?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block font-mono text-xs text-muted">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function ImagePicker({ file, onChange }: { file: File | null; onChange: (f: File | null) => void }) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-line bg-background p-4 hover:border-navy">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Selected" className="h-24 w-24 rounded-xl object-cover" />
      ) : (
        <span className="grid h-24 w-24 place-items-center rounded-xl bg-black/5 text-3xl text-muted">+</span>
      )}
      <span className="text-sm">
        <span className="font-medium">{file ? file.name : "Choose an image"}</span>
        <span className="block text-xs text-muted">
          {file ? `${(file.size / 1024).toFixed(0)} KB · ${file.type}` : "JPEG / PNG / WebP, one face, max 10 MB"}
        </span>
      </span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function ResultMeta({ result }: { result: ApiResult<unknown> }) {
  const rl = result.rateLimit;
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span>
        <span className="font-semibold text-emerald-700">{result.status}</span> · {result.ms} ms
      </span>
      {rl.limit && (
        <span>
          rate {rl.remaining}/{rl.limit}
        </span>
      )}
      {result.requestId && <span className="font-mono">req {short(result.requestId)}</span>}
    </div>
  );
}

function ErrorBox({ error, className = "" }: { error: ApiError; className?: string }) {
  return (
    <div className={`rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 ${className}`}>
      <p>
        <span className="font-mono font-semibold">{error.status || "—"} {error.code}</span>
      </p>
      <p className="mt-1">{error.message}</p>
      {error.details != null && <Json value={error.details} compact />}
    </div>
  );
}

function Json({ value, compact = false }: { value: unknown; compact?: boolean }) {
  return (
    <pre
      className={`overflow-x-auto rounded-2xl bg-navy p-4 font-mono text-[12px] leading-relaxed text-white/85 ${
        compact ? "mt-1 max-h-40" : "mt-4 max-h-96"
      }`}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function Code({ children, className = "" }: { children: string; className?: string }) {
  return (
    <pre className={`overflow-x-auto rounded-2xl bg-navy p-4 font-mono text-[12px] leading-relaxed text-white/85 ${className}`}>
      {children}
    </pre>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-mono font-semibold">{value}</p>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">{children}</p>;
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-xs text-amber-700">{children}</p>;
}

function toApiError(e: unknown): ApiError {
  return e instanceof ApiError ? e : new ApiError(0, "UNKNOWN", e instanceof Error ? e.message : "Unknown error");
}

function short(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
