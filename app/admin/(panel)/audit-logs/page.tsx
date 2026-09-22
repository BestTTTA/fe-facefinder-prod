"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { adminApi, type AuditLog } from "@/lib/admin";
import { Button } from "@/components/Button";
import { Badge, ErrorText, PageHeader, Table, errMsg, fmtDate, inputCls, selectCls } from "@/components/admin/ui";

const PAGE = 50;

const RESOURCE_TYPES = ["", "profile", "package", "admin_user", "api_key", "face", "person"];

export default function AuditLogsPage() {
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (action) qs.set("action", action);
      if (resourceType) qs.set("resource_type", resourceType);
      setRows(await adminApi<AuditLog[]>(`/audit-logs?${qs}`));
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, [action, resourceType, offset]);

  useEffect(() => {
    // Fetch on mount / filter change; state is written when the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title="Audit logs" subtitle="Every admin action, newest first." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={action}
          onChange={(e) => {
            setOffset(0);
            setAction(e.target.value);
          }}
          placeholder="Filter by action, e.g. user_package_changed"
          className={inputCls}
        />
        <select
          value={resourceType}
          onChange={(e) => {
            setOffset(0);
            setResourceType(e.target.value);
          }}
          className={selectCls}
        >
          {RESOURCE_TYPES.map((r) => (
            <option key={r} value={r}>{r || "All resources"}</option>
          ))}
        </select>
        <Button variant="outline" onClick={() => void load()} disabled={busy}>{busy ? "Loading…" : "Refresh"}</Button>
      </div>
      {err && <ErrorText>{err}</ErrorText>}

      <Table head={["Time", "Action", "Actor", "Resource", "IP", ""]}>
        {rows.length === 0 && !busy && (
          <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No entries.</td></tr>
        )}
        {rows.map((r) => (
          <Fragment key={r.id}>
            <tr>
              <td className="px-4 py-2.5 whitespace-nowrap text-muted">{fmtDate(r.created_at, true)}</td>
              <td className="px-4 py-2.5"><Badge tone={r.action.includes("suspend") || r.action.includes("delete") ? "bad" : "neutral"}>{r.action}</Badge></td>
              <td className="px-4 py-2.5 font-mono text-xs">{r.actor_type} {r.actor_id ? r.actor_id.slice(0, 8) : ""}</td>
              <td className="px-4 py-2.5 font-mono text-xs">{r.resource_type ?? "—"} {r.resource_id ? r.resource_id.slice(0, 8) : ""}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted">{r.ip_address ?? "—"}</td>
              <td className="px-4 py-2.5 text-right">
                {r.metadata && Object.keys(r.metadata).length > 0 && (
                  <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => setOpen(open === r.id ? null : r.id)}>
                    {open === r.id ? "Hide" : "Details"}
                  </button>
                )}
              </td>
            </tr>
            {open === r.id && (
              <tr>
                <td colSpan={6} className="bg-black/[0.02] px-4 py-3">
                  <pre className="overflow-x-auto font-mono text-xs text-muted">{JSON.stringify(r.metadata, null, 2)}</pre>
                  {r.user_agent && <p className="mt-2 truncate text-[11px] text-muted">{r.user_agent}</p>}
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </Table>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={offset === 0 || busy} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Prev</Button>
        <Button variant="outline" size="sm" disabled={rows.length < PAGE || busy} onClick={() => setOffset(offset + PAGE)}>Next</Button>
      </div>
    </>
  );
}
