"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { API_URL, apiFull, ApiError } from "@/lib/api";
import { setAdminToken, type AdminUser } from "@/lib/admin";

type LoginOut = { token: string; token_type: string; expires_at: string; admin: AdminUser };

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFull<LoginOut>("/api/v1/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        bearer: "", // never send a stale user token here
      });
      setAdminToken(r.data.token);
      router.replace("/admin");
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.code}: ${e.message}` : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 shadow-xl shadow-navy/5">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="rounded-full bg-navy px-2.5 py-1 text-xs font-semibold text-white">Admin</span>
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Admin console</h1>
        <p className="mt-1 text-sm text-muted">
          Separate from customer accounts. The first admin comes from{" "}
          <code className="font-mono text-xs">ADMIN_BOOTSTRAP_USERNAME</code> in the API&apos;s .env.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            required
            className="h-11 w-full rounded-full border border-line bg-background px-4 text-sm outline-none focus:border-navy"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            className="h-11 w-full rounded-full border border-line bg-background px-4 text-sm outline-none focus:border-navy"
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button type="submit" variant="dark" size="lg" className="w-full" disabled={busy || !username || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          API: <span className="font-mono">{API_URL}</span>
        </p>
      </div>
    </main>
  );
}
