"use client";

import { useEffect, useState } from "react";
import { adminApi, type PackageOut } from "@/lib/admin";
import { fmtBytes, fmtLimit } from "@/lib/services";
import { Button } from "@/components/Button";
import { Badge, Card, ErrorText, PageHeader, Table, errMsg, inputCls, selectCls } from "@/components/admin/ui";

const GB = 1024 ** 3;

type Form = {
  name: string;
  description: string;
  price: string;
  currency: string;
  billing_cycle: string;
  upload_limit: string;
  search_limit: string;
  storage_gb: string; // -1 = unlimited
  max_users: string;
  api_rate_limit: string;
  is_active: boolean;
  is_default: boolean;
};

const empty: Form = {
  name: "",
  description: "",
  price: "0",
  currency: "USD",
  billing_cycle: "monthly",
  upload_limit: "1000",
  search_limit: "1000",
  storage_gb: "5",
  max_users: "1",
  api_rate_limit: "60",
  is_active: true,
  is_default: false,
};

function toForm(p: PackageOut): Form {
  return {
    name: p.name,
    description: p.description ?? "",
    price: String(p.price),
    currency: p.currency,
    billing_cycle: p.billing_cycle,
    upload_limit: String(p.upload_limit),
    search_limit: String(p.search_limit),
    storage_gb: p.storage_limit === -1 ? "-1" : String(p.storage_limit / GB),
    max_users: String(p.max_users),
    api_rate_limit: String(p.api_rate_limit),
    is_active: p.is_active ?? true,
    is_default: p.is_default ?? false,
  };
}

function toBody(f: Form) {
  const storage = Number(f.storage_gb);
  return {
    name: f.name.trim(),
    description: f.description.trim() || null,
    price: Number(f.price),
    currency: f.currency.toUpperCase(),
    billing_cycle: f.billing_cycle,
    upload_limit: Number(f.upload_limit),
    search_limit: Number(f.search_limit),
    storage_limit: storage === -1 ? -1 : Math.round(storage * GB),
    max_users: Number(f.max_users),
    api_rate_limit: Number(f.api_rate_limit),
    is_active: f.is_active,
    is_default: f.is_default,
  };
}

export default function AdminPackagesPage() {
  const [rows, setRows] = useState<PackageOut[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<PackageOut | "new" | null>(null);

  async function load() {
    setErr(null);
    try {
      setRows(await adminApi<PackageOut[]>("/packages"));
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  useEffect(() => {
    // Fetch on mount / filter change; state is written when the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function remove(p: PackageOut) {
    if (!window.confirm(`Delete package "${p.name}"? Packages with subscription history are deactivated instead.`)) return;
    try {
      await adminApi(`/packages/${p.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Packages"
        subtitle="Limits apply immediately to every tenant on the package. -1 means unlimited."
        action={<Button variant="dark" size="sm" onClick={() => setEditing("new")}>New package</Button>}
      />
      {err && <ErrorText>{err}</ErrorText>}

      <div className={`grid gap-6 ${editing ? "xl:grid-cols-[1fr_420px]" : ""}`}>
        <Table head={["Package", "Price", "Uploads / mo", "Searches / mo", "Storage", "Rate / min", "Users", "Flags", ""]}>
          {rows.map((p) => (
            <tr key={p.id} className={editing !== "new" && editing?.id === p.id ? "bg-black/[0.03]" : ""}>
              <td className="px-4 py-2.5">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted">{p.description}</div>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">${p.price} / {p.billing_cycle}</td>
              <td className="px-4 py-2.5 tabular-nums">{fmtLimit(p.upload_limit)}</td>
              <td className="px-4 py-2.5 tabular-nums">{fmtLimit(p.search_limit)}</td>
              <td className="px-4 py-2.5">{fmtBytes(p.storage_limit)}</td>
              <td className="px-4 py-2.5 tabular-nums">{p.api_rate_limit}</td>
              <td className="px-4 py-2.5 tabular-nums">{fmtLimit(p.max_users)}</td>
              <td className="px-4 py-2.5 space-x-1">
                {p.is_default && <Badge tone="ok">default</Badge>}
                {p.is_active === false && <Badge tone="bad">inactive</Badge>}
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap text-right">
                <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>Edit</Button>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void remove(p)}>Delete</Button>
              </td>
            </tr>
          ))}
        </Table>

        {editing && (
          <PackageForm
            key={editing === "new" ? "new" : editing.id}
            pkg={editing === "new" ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              await load();
            }}
          />
        )}
      </div>
    </>
  );
}

function PackageForm({ pkg, onClose, onSaved }: { pkg: PackageOut | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [f, setF] = useState<Form>(pkg ? toForm(pkg) : empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const body = JSON.stringify(toBody(f));
      if (pkg) await adminApi(`/packages/${pkg.id}`, { method: "PATCH", body });
      else await adminApi("/packages", { method: "POST", body });
      await onSaved();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const num = (k: keyof Form, label: string, hint?: string) => (
    <label className="block">
      <span className="mb-1 block font-mono text-xs text-muted">{label}</span>
      <input value={String(f[k])} onChange={(e) => set(k, e.target.value as never)} inputMode="decimal" className={inputCls} disabled={busy} />
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );

  return (
    <Card
      title={pkg ? `Edit ${pkg.name}` : "New package"}
      action={<button type="button" onClick={onClose} className="text-sm text-muted hover:text-foreground">Close</button>}
      className="self-start"
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block font-mono text-xs text-muted">name</span>
          <input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} disabled={busy} />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-xs text-muted">description</span>
          <input value={f.description} onChange={(e) => set("description", e.target.value)} className={inputCls} disabled={busy} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          {num("price", "price")}
          <label className="block">
            <span className="mb-1 block font-mono text-xs text-muted">currency</span>
            <input value={f.currency} onChange={(e) => set("currency", e.target.value)} maxLength={3} className={inputCls} disabled={busy} />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-xs text-muted">billing</span>
            <select value={f.billing_cycle} onChange={(e) => set("billing_cycle", e.target.value)} className={`${selectCls} w-full`} disabled={busy}>
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
              <option value="custom">custom</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {num("upload_limit", "upload_limit", "per month, -1 = unlimited")}
          {num("search_limit", "search_limit", "per month, -1 = unlimited")}
          {num("storage_gb", "storage (GB)", "-1 = unlimited")}
          {num("api_rate_limit", "api_rate_limit", "requests per minute")}
          {num("max_users", "max_users", "-1 = unlimited")}
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} disabled={busy} /> active
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.is_default} onChange={(e) => set("is_default", e.target.checked)} disabled={busy} /> default for new signups
          </label>
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <Button variant="dark" className="w-full" disabled={busy || !f.name.trim()} onClick={() => void save()}>
          {busy ? "Saving…" : pkg ? "Save changes" : "Create package"}
        </Button>
      </div>
    </Card>
  );
}
