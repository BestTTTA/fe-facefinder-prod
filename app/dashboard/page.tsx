"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Button, ButtonLink } from "@/components/Button";
import {
  api,
  ApiError,
  getToken,
  setToken,
  SCOPES,
  type ApiKey,
  type Profile,
  type QuotaItem,
  type Usage,
  type UsagePeriod,
} from "@/lib/api";
import { fmtBytes, fmtLimit } from "@/lib/services";

type State = {
  profile: Profile;
  usage: Usage;
  keys: ApiKey[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<ApiKey | null>(null);
  const loadedOnce = useRef(false);

  // Kept to 3 requests: the Free package allows only 10 req/min per tenant.
  // /me/usage already carries package name, limits and subscription status.
  const load = useCallback(async () => {
    try {
      const [profile, usage, keys] = await Promise.all([
        api<Profile>("/api/v1/me"),
        api<Usage>("/api/v1/me/usage"),
        api<ApiKey[]>("/api/v1/me/api-keys"),
      ]);
      setState({ profile, usage, keys });
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setToken(null);
        router.replace(`/login?reason=${encodeURIComponent(e.message)}`);
        return;
      }
      if (e instanceof ApiError && e.status === 429) {
        setError("Rate limit exceeded: the Free package allows 10 requests per minute. Wait a minute, then retry.");
        return;
      }
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [router]);

  useEffect(() => {
    // Supabase implicit flow returns #access_token=… on the redirect URL.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const fromHash = hash.get("access_token");
    if (fromHash) {
      setToken(fromHash);
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    // React StrictMode runs effects twice in dev; do not double-spend the rate limit.
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    void load();
  }, [load, router]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-10 sm:px-6">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}{" "}
            <button className="underline" onClick={() => void load()}>Retry</button>
          </div>
        )}

        {!state && !error && <p className="text-sm text-muted">Loading…</p>}

        {state && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Hi{state.profile.name ? `, ${state.profile.name.split(" ")[0]}` : ""}
                </h1>
                <p className="mt-1 text-sm text-muted">
                  {state.profile.email} · period {fmtDate(state.usage.period.start)} →{" "}
                  {fmtDate(state.usage.period.end)}
                </p>
              </div>
              <PackageBadge name={state.usage.package.name} status={state.usage.subscription.status} />
            </div>

            <section className="grid gap-4 sm:grid-cols-3">
              <Meter label="Face uploads" item={state.usage.uploads} />
              <Meter label="Face searches" item={state.usage.searches} />
              <Meter label="Storage" item={state.usage.storage} bytes />
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <KeysPanel
                keys={state.keys}
                onChanged={load}
                onCreated={setNewKey}
              />
              <div className="space-y-4">
                <Card title="Package limits">
                  <ul className="space-y-2 text-sm">
                    <Row k="Uploads / month" v={fmtLimit(state.usage.uploads.limit)} />
                    <Row k="Searches / month" v={fmtLimit(state.usage.searches.limit)} />
                    <Row k="Storage" v={fmtBytes(state.usage.storage.limit)} />
                    <Row k="Rate limit" v={`${state.usage.api_requests.rate_limit_per_minute} req / min`} />
                    <Row k="API requests this period" v={state.usage.api_requests.used.toLocaleString()} />
                  </ul>
                  <ButtonLink href="/dashboard/people" variant="outline" size="sm" className="mt-5 w-full">
                    Manage registered people
                  </ButtonLink>
                  <ButtonLink href="/pricing" variant="dark" size="sm" className="mt-2 w-full">
                    Upgrade package
                  </ButtonLink>
                </Card>
                <HistoryCard />
              </div>
            </section>
          </>
        )}
      </main>

      {newKey?.api_key && (
        <NewKeyModal apiKey={newKey.api_key} name={newKey.name} onClose={() => setNewKey(null)} />
      )}
    </div>
  );
}

/* ---------- pieces ---------- */

function PackageBadge({ name, status }: { name: string; status: string }) {
  return (
    <div className="flex items-center gap-3 rounded-full border border-line bg-surface py-1.5 pl-4 pr-2 text-sm">
      <span>
        Package <strong>{name}</strong>
      </span>
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          status === "active" || status === "trial"
            ? "bg-emerald-100 text-emerald-700"
            : "bg-amber-100 text-amber-700"
        }`}
      >
        {status}
      </span>
    </div>
  );
}

function Meter({ label, item, bytes = false }: { label: string; item: QuotaItem; bytes?: boolean }) {
  const unlimited = item.unlimited || item.limit == null || item.limit === -1;
  const limit = item.limit ?? 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((item.used / Math.max(limit, 1)) * 100));
  const fmt = (n: number) => (bytes ? fmtBytes(n) : n.toLocaleString());
  return (
    <div className="rounded-3xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">
        {fmt(item.used)}
        <span className="text-base font-normal text-muted"> / {unlimited ? "∞" : fmt(limit)}</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/5">
        <div
          className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : "bg-orange"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        {unlimited ? "Unlimited" : `${fmt(item.remaining ?? 0)} remaining`}
      </p>
    </div>
  );
}

// Loaded on demand so the initial page view stays within the rate limit.
function HistoryCard() {
  const [rows, setRows] = useState<UsagePeriod[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      setRows(await api<UsagePeriod[]>("/api/v1/me/usage/history?limit=6"));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Usage history"
      action={
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void load()}>
          {rows ? "Refresh" : busy ? "Loading…" : "Load"}
        </Button>
      }
    >
      {err && <p className="text-sm text-red-600">{err}</p>}
      {!rows && !err && <p className="text-sm text-muted">Click Load to fetch past periods.</p>}
      {rows && rows.length === 0 && <p className="text-sm text-muted">No past periods yet.</p>}
      {rows && rows.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="pb-2 text-left font-medium">Period</th>
              <th className="pb-2 text-right font-medium">Uploads</th>
              <th className="pb-2 text-right font-medium">Searches</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((h) => (
              <tr key={h.period_start}>
                <td className="py-1.5">{fmtDate(h.period_start, true)}</td>
                <td className="py-1.5 text-right tabular-nums">{h.upload_count}</td>
                <td className="py-1.5 text-right tabular-nums">{h.search_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex justify-between gap-3">
      <span className="text-muted">{k}</span>
      <span className="font-medium">{v}</span>
    </li>
  );
}

function KeysPanel({
  keys,
  onChanged,
  onCreated,
}: {
  keys: ApiKey[];
  onChanged: () => Promise<void>;
  onCreated: (k: ApiKey) => void;
}) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["faces:upload", "faces:search"]);
  const [expires, setExpires] = useState("90d");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const create = () =>
    run(async () => {
      const k = await api<ApiKey>("/api/v1/me/api-keys", {
        method: "POST",
        body: JSON.stringify({ name, scopes, expires_in: expires }),
      });
      setName("");
      onCreated(k);
    });

  const rotate = (id: string) =>
    run(async () => {
      const k = await api<ApiKey>(`/api/v1/me/api-keys/${id}/rotate`, { method: "POST" });
      onCreated(k);
    });

  const revoke = (id: string) =>
    run(async () => {
      await api(`/api/v1/me/api-keys/${id}`, { method: "DELETE" });
    });

  return (
    <Card title="API keys">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
        className="rounded-2xl border border-dashed border-line bg-background p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Key name, e.g. production-server"
            required
            className="h-10 flex-1 rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-navy"
          />
          <select
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className="h-10 rounded-full border border-line bg-surface px-3 text-sm outline-none focus:border-navy"
          >
            {["7d", "30d", "90d", "1y", "never"].map((o) => (
              <option key={o} value={o}>
                {o === "never" ? "Never expires" : `Expires in ${o}`}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" className="h-10" disabled={busy || !name.trim() || scopes.length === 0}>
            Create key
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SCOPES.map((s) => {
            const on = scopes.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => setScopes(on ? scopes.filter((x) => x !== s) : [...scopes, s])}
                className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                  on ? "border-navy bg-navy text-white" : "border-line bg-surface text-muted hover:border-navy"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </form>

      <ul className="mt-4 divide-y divide-line">
        {keys.length === 0 && (
          <li className="py-6 text-center text-sm text-muted">No keys yet — create one above.</li>
        )}
        {keys.map((k) => (
          <li key={k.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{k.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    k.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-black/5 text-muted"
                  }`}
                >
                  {k.status}
                </span>
              </div>
              <p className="mt-0.5 truncate font-mono text-xs text-muted">
                {k.key_prefix}… · {k.scopes.join(", ")}
              </p>
              <p className="text-xs text-muted">
                {k.last_used_at ? `Last used ${fmtDate(k.last_used_at)}` : "Never used"}
                {k.expires_at ? ` · expires ${fmtDate(k.expires_at)}` : ""}
              </p>
            </div>
            {k.status === "active" && (
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void rotate(k.id)}>
                  Rotate
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} className="text-red-600" onClick={() => void revoke(k.id)}>
                  Revoke
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function NewKeyModal({ apiKey, name, onClose }: { apiKey: string; name: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4" role="dialog" aria-modal>
      <div className="w-full max-w-lg rounded-3xl bg-surface p-6 shadow-2xl">
        <h3 className="text-lg font-semibold">Key “{name}” is ready</h3>
        <p className="mt-1 text-sm text-muted">
          Copy it now — this is the only time the full key is shown.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-navy p-4 font-mono text-sm text-white">{apiKey}</pre>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={copy}>{copied ? "Copied" : "Copy"}</Button>
          <Button variant="dark" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso: string, monthOnly = false) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, monthOnly
    ? { month: "short", year: "numeric" }
    : { day: "numeric", month: "short", year: "numeric" });
}
