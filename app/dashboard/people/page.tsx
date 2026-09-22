"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/Button";
import {
  api,
  ApiError,
  apiFull,
  getToken,
  setToken,
  type FaceOut,
  type PersonOut,
} from "@/lib/api";
import { bulkRun, toggleId } from "@/lib/bulk";

const PAGE = 24;

export default function PeoplePage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [persons, setPersons] = useState<PersonOut[] | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<PersonOut | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (q.trim()) qs.set("q", q.trim());
      const r = await apiFull<PersonOut[]>(`/api/v1/persons?${qs}`);
      setPersons(r.data);
      setPicked(new Set());
      setTotal((r.meta as { total?: number } | undefined)?.total ?? r.data.length);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setToken(null);
        router.replace("/login");
        return;
      }
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }, [offset, q, router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    if (loaded.current) return;
    loaded.current = true;
    void load();
  }, [load, router]);

  async function onPersonDeleted(id: string) {
    setSelected(null);
    setPersons((prev) => prev?.filter((p) => p.id !== id) ?? null);
    setTotal((t) => Math.max(0, t - 1));
    setPicked((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  async function deletePicked() {
    const ids = [...picked];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Delete ${ids.length} ${ids.length === 1 ? "person" : "people"} and all their photos? Searches will stop matching them.`,
      )
    )
      return;
    setBusy(true);
    setErr(null);
    setProgress(`Deleting 0/${ids.length}…`);
    const res = await bulkRun(
      ids,
      (id) => api(`/api/v1/persons/${id}`, { method: "DELETE" }),
      (p) => setProgress(`Deleting ${p.done}/${p.total}…`),
    );
    const gone = new Set(res.ok);
    setPersons((prev) => prev?.filter((p) => !gone.has(p.id)) ?? null);
    setTotal((t) => Math.max(0, t - res.ok.length));
    if (selected && gone.has(selected.id)) setSelected(null);
    setPicked(new Set());
    setProgress(null);
    if (res.failed.length) setErr(`${res.failed.length} of ${ids.length} could not be deleted: ${res.failed[0].message}`);
    setBusy(false);
  }

  const allOnPage = persons?.map((p) => p.id) ?? [];
  const allPicked = allOnPage.length > 0 && allOnPage.every((id) => picked.has(id));

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Registered people</h1>
            <p className="mt-1 text-sm text-muted">
              {total.toLocaleString()} person{total === 1 ? "" : "s"} in your tenant. Deleting removes the stored
              images and embeddings — searches stop matching them straight away.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={q}
            onChange={(e) => {
              setOffset(0);
              setQ(e.target.value);
            }}
            onKeyDown={(e) => e.key === "Enter" && void load()}
            placeholder="Search by name or external id"
            className="h-10 w-full rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-navy"
          />
          <Button variant="outline" onClick={() => void load()} disabled={busy}>
            {busy ? "Loading…" : "Search"}
          </Button>
        </div>

        {persons && persons.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
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
              onClick={() => void deletePicked()}
            >
              Delete selected
            </Button>
            {progress && <span className="text-sm text-muted">{progress}</span>}
          </div>
        )}

        {err && (
          <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>
        )}

        <div className={`grid gap-6 ${selected ? "xl:grid-cols-[1fr_400px]" : ""}`}>
          <div>
            {persons === null ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : persons.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-line p-10 text-center text-sm text-muted">
                No one registered yet. Enroll someone from the{" "}
                <a href="/playground" className="underline">playground</a>.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {persons.map((p) => (
                  <li
                    key={p.id}
                    className={`relative rounded-3xl border bg-surface transition-colors ${
                      picked.has(p.id)
                        ? "border-orange"
                        : selected?.id === p.id
                          ? "border-navy"
                          : "border-line hover:border-navy/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(p.id)}
                      onChange={() => setPicked((set) => toggleId(set, p.id))}
                      disabled={busy}
                      aria-label={`Select ${p.name ?? p.id}`}
                      className="absolute left-4 top-4 accent-orange"
                    />
                    <button type="button" onClick={() => setSelected(p)} className="w-full p-4 pl-10 text-left">
                      <p className="truncate font-semibold">{p.name ?? "(no name)"}</p>
                      {p.external_user_id && (
                        <p className="truncate font-mono text-xs text-muted">{p.external_user_id}</p>
                      )}
                      <p className="mt-2 text-xs text-muted">
                        {p.face_count != null ? `${p.face_count} photo${p.face_count === 1 ? "" : "s"}` : "—"}
                        {p.company ? ` · ${p.company}` : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {total > PAGE && (
              <div className="mt-4 flex items-center justify-between text-sm text-muted">
                <span>
                  {offset + 1}–{Math.min(offset + PAGE, total)} of {total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0 || busy}
                    onClick={() => {
                      setOffset(Math.max(0, offset - PAGE));
                      setTimeout(() => void load(), 0);
                    }}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset + PAGE >= total || busy}
                    onClick={() => {
                      setOffset(offset + PAGE);
                      setTimeout(() => void load(), 0);
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>

          {selected && (
            <PersonPanel
              key={selected.id}
              person={selected}
              onClose={() => setSelected(null)}
              onDeleted={onPersonDeleted}
              onUpdated={(p) => {
                setSelected(p);
                setPersons((prev) => prev?.map((x) => (x.id === p.id ? p : x)) ?? null);
              }}
            />
          )}
        </div>
      </main>
    </>
  );
}

function PersonPanel({
  person,
  onClose,
  onDeleted,
  onUpdated,
}: {
  person: PersonOut;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onUpdated: (p: PersonOut) => void;
}) {
  const [faces, setFaces] = useState<FaceOut[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: person.name ?? "",
    external_user_id: person.external_user_id ?? "",
    email: person.email ?? "",
    phone: person.phone ?? "",
    company: person.company ?? "",
    department: person.department ?? "",
    metadata: JSON.stringify(person.metadata ?? {}, null, 2),
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pickedFaces, setPickedFaces] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<string | null>(null);

  const loadFaces = useCallback(async () => {
    setErr(null);
    try {
      setFaces(await api<FaceOut[]>(`/api/v1/faces?person_id=${person.id}&with_urls=true`));
      setPickedFaces(new Set());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load photos");
    }
  }, [person.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadFaces();
  }, [loadFaces]);

  async function deleteFaces(ids: string[]) {
    if (ids.length === 0) return;
    const what = ids.length === 1 ? "this photo" : `${ids.length} photos`;
    if (!window.confirm(`Delete ${what}? The images and their embeddings are removed permanently.`)) return;
    setBusy(true);
    setErr(null);
    setProgress(`Deleting 0/${ids.length}…`);
    const res = await bulkRun(
      ids,
      (id) => api(`/api/v1/faces/${id}`, { method: "DELETE" }),
      (p) => setProgress(`Deleting ${p.done}/${p.total}…`),
    );
    const gone = new Set(res.ok);
    setFaces((prev) => prev?.filter((x) => !gone.has(x.id)) ?? null);
    setPickedFaces(new Set());
    setProgress(null);
    if (res.failed.length) setErr(`${res.failed.length} of ${ids.length} could not be deleted: ${res.failed[0].message}`);
    setBusy(false);
  }

  const allFaceIds = faces?.map((f) => f.id) ?? [];
  const allFacesPicked = allFaceIds.length > 0 && allFaceIds.every((id) => pickedFaces.has(id));

  async function deletePerson() {
    if (
      !window.confirm(
        `Delete ${person.name ?? "this person"} and all their photos? Searches will stop matching them.`,
      )
    )
      return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/v1/persons/${person.id}`, { method: "DELETE" });
      onDeleted(person.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  async function save() {
    let metadata: Record<string, unknown>;
    try {
      metadata = form.metadata.trim() ? JSON.parse(form.metadata) : {};
      if (typeof metadata !== "object" || Array.isArray(metadata)) throw new Error();
    } catch {
      setErr("metadata must be a JSON object");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const updated = await api<PersonOut>(`/api/v1/persons/${person.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name || null,
          external_user_id: form.external_user_id || null,
          email: form.email || null,
          phone: form.phone || null,
          company: form.company || null,
          department: form.department || null,
          metadata,
        }),
      });
      onUpdated(updated);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="h-fit rounded-3xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold">{person.name ?? "(no name)"}</h2>
          <p className="truncate font-mono text-xs text-muted">{person.id}</p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 text-sm text-muted hover:text-foreground">
          Close
        </button>
      </div>

      {err && <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          Photos {faces && <span className="text-muted">({faces.length})</span>}
        </p>
        {faces && faces.length > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={allFacesPicked}
                onChange={() => setPickedFaces(allFacesPicked ? new Set() : new Set(allFaceIds))}
                disabled={busy}
                className="accent-orange"
              />
              All
            </label>
            <button
              type="button"
              disabled={busy || pickedFaces.size === 0}
              onClick={() => void deleteFaces([...pickedFaces])}
              className="text-red-600 disabled:opacity-40"
            >
              Delete {pickedFaces.size > 0 ? `(${pickedFaces.size})` : "selected"}
            </button>
          </div>
        )}
      </div>
      {progress && <p className="mb-2 text-xs text-muted">{progress}</p>}
      {faces === null ? (
        <p className="text-sm text-muted">Loading photos…</p>
      ) : faces.length === 0 ? (
        <p className="text-sm text-muted">No photos stored.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {faces.map((f) => (
            <li key={f.id} className="group relative">
              <input
                type="checkbox"
                checked={pickedFaces.has(f.id)}
                onChange={() => setPickedFaces((s) => toggleId(s, f.id))}
                disabled={busy}
                aria-label={`Select photo ${f.id.slice(0, 8)}`}
                className="absolute left-1.5 top-1.5 z-10 accent-orange"
              />
              {f.thumbnail_url || f.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={f.thumbnail_url ?? f.image_url ?? ""}
                  alt=""
                  title={`det_score ${f.det_score?.toFixed(3) ?? "—"}`}
                  className={`aspect-square w-full rounded-xl border object-cover ${
                    pickedFaces.has(f.id) ? "border-orange ring-2 ring-orange/40" : "border-line"
                  }`}
                />
              ) : (
                <span className="grid aspect-square w-full place-items-center rounded-xl border border-line bg-black/5 text-[10px] text-muted">
                  no image
                </span>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void deleteFaces([f.id])}
                title="Delete this photo"
                className="absolute right-1 top-1 hidden h-6 w-6 place-items-center rounded-full bg-red-600 text-xs font-bold text-white group-hover:grid"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Details</p>
          <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)} disabled={busy}>
            {editing ? "Cancel" : "Edit"}
          </Button>
        </div>

        {editing ? (
          <div className="space-y-2">
            {(["name", "external_user_id", "email", "phone", "company", "department"] as const).map((k) => (
              <label key={k} className="block">
                <span className="mb-1 block font-mono text-xs text-muted">{k}</span>
                <input
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  className="h-9 w-full rounded-full border border-line bg-background px-3 text-sm outline-none focus:border-navy"
                />
              </label>
            ))}
            <label className="block">
              <span className="mb-1 block font-mono text-xs text-muted">metadata</span>
              <textarea
                value={form.metadata}
                onChange={(e) => setForm({ ...form, metadata: e.target.value })}
                rows={4}
                spellCheck={false}
                className="w-full rounded-2xl border border-line bg-background px-3 py-2 font-mono text-xs outline-none focus:border-navy"
              />
            </label>
            <Button variant="dark" className="w-full" disabled={busy} onClick={() => void save()}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {(["external_user_id", "email", "phone", "company", "department"] as const).map((k) =>
              person[k] ? (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="truncate">{person[k]}</dd>
                </div>
              ) : null,
            )}
            {Object.entries(person.metadata ?? {}).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-mono text-muted">{k}</dt>
                <dd className="truncate">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <Button variant="outline" size="sm" className="w-full text-red-600" disabled={busy} onClick={() => void deletePerson()}>
          Delete person and all photos
        </Button>
      </div>
    </aside>
  );
}
