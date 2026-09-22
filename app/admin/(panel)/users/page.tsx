"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, adminApiFull, SUBSCRIPTION_STATUSES, type AdminFace, type PackageOut, type UserRow } from "@/lib/admin";
import { bulkRun } from "@/lib/bulk";
import { Button } from "@/components/Button";
import { UserData } from "@/components/admin/UserData";
import { Badge, Card, ErrorText, PageHeader, Table, errMsg, fmtDate, inputCls, selectCls, statusTone } from "@/components/admin/ui";

const PAGE = 25;

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [packages, setPackages] = useState<PackageOut[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (q) qs.set("q", q);
      if (status) qs.set("status", status);
      const r = await adminApiFull<UserRow[]>(`/users?${qs}`);
      setRows(r.data);
      setTotal((r.meta as { total?: number } | undefined)?.total ?? r.data.length);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [q, status, offset]);

  useEffect(() => {
    // Fetch on mount / filter change; state is written when the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    adminApi<PackageOut[]>("/packages").then(setPackages).catch(() => undefined);
  }, []);

  function onUpdated(u: UserRow) {
    setSelected(u);
    setRows((rs) => rs.map((r) => (r.id === u.id ? { ...r, ...u } : r)));
  }

  function onDeleted(id: string) {
    setSelected(null);
    setRows((rs) => rs.filter((r) => r.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }

  return (
    <>
      <PageHeader title="Users" subtitle={`${total.toLocaleString()} account${total === 1 ? "" : "s"}`} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={q}
          onChange={(e) => {
            setOffset(0);
            setQ(e.target.value);
          }}
          placeholder="Search email or name"
          className={inputCls}
        />
        <select
          value={status}
          onChange={(e) => {
            setOffset(0);
            setStatus(e.target.value);
          }}
          className={selectCls}
        >
          <option value="">All statuses</option>
          <option value="active">active</option>
          <option value="suspended">suspended</option>
        </select>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>
          {busy ? "Loading…" : "Refresh"}
        </Button>
      </div>
      {err && <ErrorText>{err}</ErrorText>}

      <div className={`grid gap-6 ${selected ? "xl:grid-cols-[1fr_380px]" : ""}`}>
        <div>
          <Table head={["User", "Package", "Subscription", "Status", "Role", "Last login", ""]}>
            {rows.length === 0 && !busy && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">No users found.</td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} className={selected?.id === u.id ? "bg-black/[0.03]" : ""}>
                <td className="px-4 py-2.5">
                  <div className="font-medium">{u.name ?? "—"}</div>
                  <div className="text-xs text-muted">{u.email}</div>
                </td>
                <td className="px-4 py-2.5">{u.package?.name ?? "—"}</td>
                <td className="px-4 py-2.5"><Badge tone={statusTone(u.subscription?.status)}>{u.subscription?.status ?? "none"}</Badge></td>
                <td className="px-4 py-2.5"><Badge tone={statusTone(u.status)}>{u.status}</Badge></td>
                <td className="px-4 py-2.5">{u.role}</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-muted">{fmtDate(u.last_login_at)}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setSelected(u)}>Manage</Button>
                </td>
              </tr>
            ))}
          </Table>
          <div className="mt-3 flex items-center justify-between text-sm text-muted">
            <span>
              {total === 0 ? "0" : `${offset + 1}–${Math.min(offset + PAGE, total)}`} of {total}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Prev</Button>
              <Button variant="outline" size="sm" disabled={offset + PAGE >= total || busy} onClick={() => setOffset(offset + PAGE)}>Next</Button>
            </div>
          </div>
        </div>

        {selected && (
          <UserPanel
            key={selected.id}
            user={selected}
            packages={packages}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
            onClose={() => setSelected(null)}
          />
        )}
      </div>

      {selected && (
        <div className="mt-6">
          <UserData key={selected.id} userId={selected.id} email={selected.email} />
        </div>
      )}
    </>
  );
}

function UserPanel({
  user,
  packages,
  onUpdated,
  onDeleted,
  onClose,
}: {
  user: UserRow;
  packages: PackageOut[];
  onUpdated: (u: UserRow) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<UserRow>(user);
  const [pkgId, setPkgId] = useState(user.package?.id ?? "");
  const [subStatus, setSubStatus] = useState(user.subscription?.status ?? "active");
  const [role, setRole] = useState(user.role);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [purgeFaces, setPurgeFaces] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    adminApi<UserRow>(`/users/${user.id}`).then(setDetail).catch(() => undefined);
  }, [user.id]);

  async function deleteUser() {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      if (purgeFaces) {
        // Faces survive the soft delete, and the user disappears from the list
        // afterwards — so purge them here while they are still reachable.
        setProgress("Collecting faces…");
        const ids: string[] = [];
        for (let offset = 0; ; offset += 200) {
          const page = await adminApi<AdminFace[]>(`/users/${user.id}/faces?limit=200&offset=${offset}`);
          ids.push(...page.map((f) => f.id));
          if (page.length < 200) break;
        }
        if (ids.length) {
          const res = await bulkRun(
            ids,
            (id) => adminApi(`/users/${user.id}/faces/${id}`, { method: "DELETE" }),
            (p) => setProgress(`Deleting faces ${p.done}/${p.total}…`),
          );
          if (res.failed.length) {
            setProgress(null);
            setErr(`${res.failed.length} of ${ids.length} faces could not be deleted — the user was not deleted.`);
            setBusy(false);
            return;
          }
        }
      }
      setProgress("Deleting user…");
      await adminApi(`/users/${user.id}`, { method: "DELETE" });
      onDeleted(user.id);
    } catch (e) {
      setErr(errMsg(e));
      setProgress(null);
      setBusy(false);
    }
  }

  async function run(label: string, fn: () => Promise<UserRow>) {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const u = await fn();
      setDetail(u);
      onUpdated(u);
      setOk(label);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const changePackage = () =>
    run("Package updated", () =>
      adminApi<UserRow>(`/users/${user.id}/package`, {
        method: "PATCH",
        body: JSON.stringify({ package_id: pkgId, status: subStatus }),
      }),
    );

  const toggleStatus = () => {
    const next = detail.status === "suspended" ? "active" : "suspended";
    if (next === "suspended" && !window.confirm(`Suspend ${detail.email}? Their API keys stop working immediately.`)) return;
    void run(next === "suspended" ? "User suspended" : "User activated", () =>
      adminApi<UserRow>(`/users/${user.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) }),
    );
  };

  const changeRole = () =>
    run("Role updated", () =>
      adminApi<UserRow>(`/users/${user.id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
    );

  return (
    <Card
      title={detail.name ?? detail.email}
      action={<button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">Close</button>}
      className="self-start"
    >
      <p className="-mt-3 mb-4 text-xs text-muted">{detail.email}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">Status</dt><dd><Badge tone={statusTone(detail.status)}>{detail.status}</Badge></dd>
        <dt className="text-muted">Package</dt><dd>{detail.package?.name ?? "—"}</dd>
        <dt className="text-muted">Subscription</dt><dd>{detail.subscription?.status ?? "—"}</dd>
        <dt className="text-muted">Created</dt><dd>{fmtDate(detail.created_at)}</dd>
        <dt className="text-muted">Last login</dt><dd>{fmtDate(detail.last_login_at, true)}</dd>
        {detail.counts &&
          Object.entries(detail.counts).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="tabular-nums">{v.toLocaleString()}</dd>
            </div>
          ))}
      </dl>
      <p className="mt-2 font-mono text-[11px] text-muted">tenant {detail.tenant_id}</p>

      <div className="mt-5 space-y-4 border-t border-line pt-4">
        <div>
          <p className="mb-2 text-sm font-medium">Package</p>
          <div className="flex flex-col gap-2">
            <select value={pkgId} onChange={(e) => setPkgId(e.target.value)} className={selectCls} disabled={busy}>
              <option value="" disabled>Select package</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — ${p.price}/{p.billing_cycle}{p.is_active === false ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select value={subStatus} onChange={(e) => setSubStatus(e.target.value)} className={`${selectCls} flex-1`} disabled={busy}>
                {SUBSCRIPTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <Button variant="dark" size="sm" disabled={busy || !pkgId} onClick={() => void changePackage()}>Apply</Button>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Role</p>
          <div className="flex gap-2">
            <select value={role} onChange={(e) => setRole(e.target.value)} className={`${selectCls} flex-1`} disabled={busy}>
              <option value="owner">owner</option>
              <option value="member">member</option>
            </select>
            <Button variant="outline" size="sm" disabled={busy || role === detail.role} onClick={() => void changeRole()}>Save</Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Account</p>
          <Button
            variant={detail.status === "suspended" ? "primary" : "outline"}
            size="sm"
            className={detail.status === "suspended" ? "" : "text-red-600"}
            disabled={busy}
            onClick={toggleStatus}
          >
            {detail.status === "suspended" ? "Activate user" : "Suspend user"}
          </Button>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}
        {ok && <p className="text-sm text-emerald-700">{ok}</p>}
      </div>

      <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/60 p-4">
        <p className="text-sm font-semibold text-red-700">Delete user</p>
        <p className="mt-1 text-xs text-red-700/90">
          Marks the profile deleted and suspends the tenant — API keys stop working immediately. Stored faces are
          kept for audit and must be purged separately from the Faces tab below.
        </p>
        <label className="mt-3 flex items-start gap-2 text-xs text-red-700">
          <input
            type="checkbox"
            checked={purgeFaces}
            onChange={(e) => setPurgeFaces(e.target.checked)}
            disabled={busy}
            className="mt-0.5 accent-red-600"
          />
          <span>
            Also delete all stored faces
            {detail.counts?.faces != null ? ` (${detail.counts.faces})` : ""} — they cannot be reached from here once
            the user is gone.
          </span>
        </label>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={`Type ${detail.email} to confirm`}
          disabled={busy}
          className="mt-3 h-9 w-full rounded-full border border-red-200 bg-surface px-3 text-sm outline-none focus:border-red-500"
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full border-red-300 text-red-700 hover:border-red-500"
          disabled={busy || confirmText.trim() !== detail.email}
          onClick={() => void deleteUser()}
        >
          {busy ? (progress ?? "Deleting…") : "Delete this user"}
        </Button>
      </div>
    </Card>
  );
}
