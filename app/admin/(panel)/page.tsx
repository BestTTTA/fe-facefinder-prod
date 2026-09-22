"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, type AdminDashboard } from "@/lib/admin";
import { fmtBytes } from "@/lib/services";
import { Card, ErrorText, PageHeader, StatTile, errMsg, fmtDate } from "@/components/admin/ui";
import { Button } from "@/components/Button";

export default function AdminOverview() {
  const [d, setD] = useState<AdminDashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      setD(await adminApi<AdminDashboard>("/dashboard"));
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  useEffect(() => {
    // Fetch on mount / filter change; state is written when the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={d ? `Generated ${fmtDate(d.generated_at, true)}` : undefined}
        action={<Button variant="outline" size="sm" onClick={() => void load()}>Refresh</Button>}
      />
      {err && <ErrorText>{err}</ErrorText>}
      {d && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Users" value={d.users.total} hint={`${d.users.active} active · ${d.users.suspended} suspended`} />
            <StatTile label="Persons enrolled" value={d.faces.persons} hint={`${d.faces.faces.toLocaleString()} faces · ${d.faces.images.toLocaleString()} images`} />
            <StatTile label="Uploads today" value={d.today.uploads} />
            <StatTile label="Searches today" value={d.today.searches} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="API requests this period" value={d.current_period.api_requests} hint={`since ${fmtDate(d.current_period.start)}`} />
            <StatTile label="Uploads this period" value={d.current_period.uploads} />
            <StatTile label="Searches this period" value={d.current_period.searches} />
            <StatTile label="Storage used" value={fmtBytes(d.storage.used_bytes)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Active subscriptions by package" action={<Link href="/admin/packages" className="text-xs text-muted hover:text-foreground">Manage →</Link>}>
              {Object.keys(d.package_distribution).length === 0 ? (
                <p className="text-sm text-muted">No active subscriptions.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(d.package_distribution)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, n]) => {
                      const max = Math.max(...Object.values(d.package_distribution), 1);
                      return (
                        <li key={name} className="text-sm">
                          <div className="flex justify-between">
                            <span>{name}</span>
                            <span className="tabular-nums text-muted">{n}</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/5">
                            <div className="h-full rounded-full bg-orange" style={{ width: `${(n / max) * 100}%` }} />
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </Card>
            <Card title="Quick links">
              <ul className="space-y-2 text-sm">
                <li><Link href="/admin/users" className="underline-offset-2 hover:underline">Search users, change packages, suspend accounts</Link></li>
                <li><Link href="/admin/packages" className="underline-offset-2 hover:underline">Edit package limits, prices and rate limits</Link></li>
                <li><Link href="/admin/audit-logs" className="underline-offset-2 hover:underline">Review admin actions in the audit log</Link></li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
