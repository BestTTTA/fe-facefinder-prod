"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";
import {
  adminApi,
  adminApiFull,
  type AdminFace,
  type SearchLogRow,
  type UploadLogRow,
} from "@/lib/admin";
import { bulkRun, toggleId } from "@/lib/bulk";
import { Badge, Table, errMsg, fmtDate, statusTone } from "./ui";

type Tab = "faces" | "uploads" | "searches";

/** Browse and delete one tenant's stored faces, plus their upload / search history. */
export function UserData({ userId, email }: { userId: string; email: string }) {
  const [tab, setTab] = useState<Tab>("faces");

  return (
    <div className="rounded-3xl border border-line bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Data for {email}</h2>
        <div className="flex gap-1 rounded-full border border-line p-1">
          {(
            [
              ["faces", "Faces"],
              ["uploads", "Uploads"],
              ["searches", "Searches"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === id ? "bg-navy text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "faces" && <FacesTab userId={userId} />}
      {tab === "uploads" && <UploadsTab userId={userId} />}
      {tab === "searches" && <SearchesTab userId={userId} />}
    </div>
  );
}

function FacesTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<AdminFace[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<AdminFace | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const PAGE = 24;

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await adminApiFull<AdminFace[]>(`/users/${userId}/faces?limit=${PAGE}&offset=${offset}&with_urls=true`);
      setRows(r.data);
      setPicked(new Set());
      setTotal((r.meta as { total?: number } | undefined)?.total ?? r.data.length);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [offset, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function removeMany(ids: string[]) {
    if (ids.length === 0) return;
    const what = ids.length === 1 ? "this face" : `${ids.length} faces`;
    if (!window.confirm(`Delete ${what}? The images and their embeddings are removed permanently.`)) return;
    setBusy(true);
    setErr(null);
    setProgress(`Deleting 0/${ids.length}…`);
    const res = await bulkRun(
      ids,
      (id) => adminApi(`/users/${userId}/faces/${id}`, { method: "DELETE" }),
      (p) => setProgress(`Deleting ${p.done}/${p.total}…`),
    );
    const deleted = new Set(res.ok);
    setRows((prev) => prev?.filter((x) => !deleted.has(x.id)) ?? null);
    setOpen((o) => (o && deleted.has(o.id) ? null : o));
    setTotal((t) => Math.max(0, t - res.ok.length));
    setPicked(new Set());
    setProgress(null);
    if (res.failed.length) setErr(`${res.failed.length} of ${ids.length} could not be deleted: ${res.failed[0].message}`);
    setBusy(false);
  }

  const allOnPage = rows?.map((f) => f.id) ?? [];
  const allPicked = allOnPage.length > 0 && allOnPage.every((id) => picked.has(id));

  return (
    <>
      {err && <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {rows && rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allPicked}
              onChange={() => setPicked(allPicked ? new Set() : new Set(allOnPage))}
              disabled={busy}
              className="accent-orange"
            />
            Select all on this page
          </label>
          <span className="text-sm text-muted">{picked.size} selected</span>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600"
            disabled={busy || picked.size === 0}
            onClick={() => void removeMany([...picked])}
          >
            Delete selected
          </Button>
          {progress && <span className="text-sm text-muted">{progress}</span>}
        </div>
      )}
      <p className="mb-3 text-xs text-muted">
        {total.toLocaleString()} face{total === 1 ? "" : "s"} stored. Click a photo for its details. Image links are
        signed and short-lived, so reload the page if a picture stops loading.
      </p>
      {rows === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
          No faces stored.
        </p>
      ) : (
        <Table head={["", "Photo", "Face", "Person", "Detection", "Registered", ""]}>
          {rows.map((f) => (
            <tr key={f.id} className={picked.has(f.id) ? "bg-orange/5" : ""}>
              <td className="px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={picked.has(f.id)}
                  onChange={() => setPicked((s) => toggleId(s, f.id))}
                  disabled={busy}
                  aria-label={`Select face ${f.id.slice(0, 8)}`}
                  className="accent-orange"
                />
              </td>
              <td className="px-4 py-2">
                <button
                  type="button"
                  onClick={() => setOpen(f)}
                  title="View image details"
                  className="block h-12 w-12 overflow-hidden rounded-lg border border-line bg-black/5 transition-transform hover:scale-105"
                >
                  {f.thumbnail_url ?? f.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={(f.thumbnail_url ?? f.image_url) as string} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-[9px] text-muted">none</span>
                  )}
                </button>
              </td>
              <td className="px-4 py-2.5 font-mono text-xs">{f.id.slice(0, 8)}…</td>
              <td className="px-4 py-2.5 font-mono text-xs">{f.person_id.slice(0, 8)}…</td>
              <td className="px-4 py-2.5 tabular-nums">{f.det_score?.toFixed(3) ?? "—"}</td>
              <td className="px-4 py-2.5 whitespace-nowrap text-muted">{fmtDate(f.created_at, true)}</td>
              <td className="px-4 py-2.5 text-right">
                <Button variant="ghost" size="sm" onClick={() => setOpen(f)}>
                  Details
                </Button>
                <Button variant="ghost" size="sm" className="text-red-600" disabled={busy} onClick={() => void removeMany([f.id])}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      {open && <FaceDetail face={open} onClose={() => setOpen(null)} onDelete={() => void removeMany([open.id])} busy={busy} />}
      {total > PAGE && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted">
          <span>
            {offset + 1}–{Math.min(offset + PAGE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              Prev
            </Button>
            <Button variant="outline" size="sm" disabled={offset + PAGE >= total || busy} onClick={() => setOffset(offset + PAGE)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** Full view of one stored image with everything the API knows about it. */
function FaceDetail({
  face,
  onClose,
  onDelete,
  busy,
}: {
  face: AdminFace;
  onClose: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const src = face.image_url ?? face.thumbnail_url ?? null;
  const box = face.bbox ?? {};
  const w = box.x2 != null && box.x1 != null ? box.x2 - box.x1 : null;
  const h = box.y2 != null && box.y1 != null ? box.y2 - box.y1 : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4" role="dialog" aria-modal>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-surface p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Image details</h3>
            <p className="font-mono text-xs text-muted">face {face.id}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">
            Close
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-[minmax(0,260px)_1fr]">
          <div className="overflow-hidden rounded-2xl border border-line bg-black/5">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className="w-full object-contain" />
            ) : (
              <p className="p-10 text-center text-sm text-muted">No image available</p>
            )}
          </div>

          <div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <Row2 k="Person" v={face.person_id} mono />
              <Row2 k="Image id" v={face.image_id} mono />
              <Row2 k="Registered" v={fmtDate(face.created_at, true)} />
              <Row2 k="Model" v={face.model} />
              <Row2 k="Detection score" v={face.det_score?.toFixed(4) ?? "\u2014"} />
              {face.image && (
                <>
                  <Row2 k="Dimensions" v={`${face.image.width} \u00d7 ${face.image.height}px`} />
                  <Row2 k="File size" v={`${Math.round(face.image.size_bytes / 1024).toLocaleString()} KB`} />
                  <Row2 k="Type" v={face.image.mime_type} />
                </>
              )}
              {w != null && h != null && <Row2 k="Face box" v={`${w} \u00d7 ${h}px at (${box.x1}, ${box.y1})`} />}
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              {src && (
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-full border border-line px-4 text-sm hover:border-navy"
                >
                  Open original
                </a>
              )}
              <Button variant="outline" size="sm" className="text-red-600" disabled={busy} onClick={onDelete}>
                Delete this photo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row2({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="contents">
      <dt className="text-muted">{k}</dt>
      <dd className={`truncate ${mono ? "font-mono text-xs" : ""}`}>{v}</dd>
    </div>
  );
}

function UploadsTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<UploadLogRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    adminApi<UploadLogRow[]>(`/users/${userId}/uploads?limit=50`).then(setRows, (e) => setErr(errMsg(e)));
  }, [userId]);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!rows) return <p className="text-sm text-muted">Loading…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted">No uploads yet.</p>;

  return (
    <Table head={["Time", "Status", "Person", "Size", "Time taken"]}>
      {rows.map((r) => (
        <tr key={r.id}>
          <td className="px-4 py-2.5 whitespace-nowrap text-muted">{fmtDate(r.created_at, true)}</td>
          <td className="px-4 py-2.5">
            <Badge tone={r.status === "success" ? "ok" : "bad"}>{r.error_code ?? r.status}</Badge>
          </td>
          <td className="px-4 py-2.5 font-mono text-xs">{r.person_id ? `${r.person_id.slice(0, 8)}…` : "—"}</td>
          <td className="px-4 py-2.5 tabular-nums">{r.file_size ? `${Math.round(r.file_size / 1024)} KB` : "—"}</td>
          <td className="px-4 py-2.5 tabular-nums text-muted">{r.processing_time_ms ? `${r.processing_time_ms} ms` : "—"}</td>
        </tr>
      ))}
    </Table>
  );
}

function SearchesTab({ userId }: { userId: string }) {
  const [rows, setRows] = useState<SearchLogRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    adminApi<SearchLogRow[]>(`/users/${userId}/searches?limit=50`).then(setRows, (e) => setErr(errMsg(e)));
  }, [userId]);

  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!rows) return <p className="text-sm text-muted">Loading…</p>;
  if (rows.length === 0) return <p className="text-sm text-muted">No searches yet.</p>;

  return (
    <Table head={["Time", "Result", "Matched person", "Similarity", "Time taken"]}>
      {rows.map((r) => (
        <tr key={r.id}>
          <td className="px-4 py-2.5 whitespace-nowrap text-muted">{fmtDate(r.created_at, true)}</td>
          <td className="px-4 py-2.5">
            <Badge tone={r.status === "match" ? "ok" : r.status === "no_match" ? "neutral" : statusTone(r.status)}>
              {r.error_code ?? r.status}
            </Badge>
          </td>
          <td className="px-4 py-2.5 font-mono text-xs">
            {r.matched_person_id ? `${r.matched_person_id.slice(0, 8)}…` : "—"}
          </td>
          <td className="px-4 py-2.5 tabular-nums">{r.similarity?.toFixed(4) ?? "—"}</td>
          <td className="px-4 py-2.5 tabular-nums text-muted">{r.processing_time_ms ? `${r.processing_time_ms} ms` : "—"}</td>
        </tr>
      ))}
    </Table>
  );
}
