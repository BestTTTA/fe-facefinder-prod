"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { api, apiBase, ApiError, API_URL, getToken, setToken, type Profile } from "@/lib/api";

// supabaseUrl is read by the server page and passed down, so the value the
// browser sees is always what the server rendered (no env-inlining mismatch).
export function LoginForm({ supabaseUrl, reason }: { supabaseUrl: string | null; reason?: string | null }) {
  const SUPABASE_URL = supabaseUrl;
  const router = useRouter();
  const [token, setTokenInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(reason ?? null);
  // Rendered as the configured value first (matching the server), then swapped
  // for the base this browser will actually call.
  const [shownApi, setShownApi] = useState(API_URL);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShownApi(apiBase() || window.location.origin);
  }, []);

  // Already signed in: go straight to the dashboard.
  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  // Google OAuth via Supabase: redirect to the hosted flow; Supabase returns
  // `#access_token=...` to /dashboard where it is picked up.
  function signInWithGoogle() {
    if (!SUPABASE_URL) return;
    const redirect = encodeURIComponent(`${window.location.origin}/dashboard`);
    // External (Supabase-hosted) URL, so a full navigation is intended.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirect}`);
  }

  // Verify against the API before navigating, so a rejected token explains itself
  // here instead of bouncing silently off the dashboard.
  async function submitToken(e: FormEvent) {
    e.preventDefault();
    const t = token.trim();
    if (!t) return;
    setChecking(true);
    setError(null);
    setToken(t);
    try {
      await api<Profile>("/api/v1/me");
      router.push("/dashboard");
    } catch (err) {
      setToken(null);
      if (err instanceof ApiError) {
        const hint =
          err.code === "INVALID_TOKEN" && err.message.includes("SUPABASE_JWT_SECRET")
            ? "This token is signed with HS256, but the API has SUPABASE_JWT_SECRET empty so it only accepts Supabase-signed tokens. Sign in with Google instead, or set that secret in the API's .env."
            : err.code === "USER_NOT_FOUND"
              ? "This token belongs to an account that no longer exists — it was deleted. Generate a new token, or sign in with Google."
              : err.code === "USER_SUSPENDED" || err.code === "ACCOUNT_SUSPENDED"
                ? "This account is suspended. An admin has to reactivate it before you can sign in."
                : `${err.code}: ${err.message}`;
        setError(hint);
      } else {
        setError(err instanceof Error ? err.message : "Could not verify the token");
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 shadow-xl shadow-navy/5">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">
          Sign in to manage API keys, packages and usage. New accounts start on
          the Free package automatically.
        </p>

        <Button
          variant="dark"
          size="lg"
          className="mt-6 w-full"
          onClick={signInWithGoogle}
          disabled={!SUPABASE_URL}
          title={SUPABASE_URL ? undefined : "Set NEXT_PUBLIC_SUPABASE_URL to enable"}
        >
          <GoogleIcon />
          Continue with Google
        </Button>
        {!SUPABASE_URL && (
          <p className="mt-2 text-center text-xs text-muted">
            Google sign-in needs <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code>.
          </p>
        )}

        <div className="my-6 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          or paste an access token
          <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={(e) => void submitToken(e)} className="space-y-3">
          <input
            value={token}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="eyJhbGciOi…"
            className="h-11 w-full rounded-full border border-line bg-background px-4 font-mono text-sm outline-none focus:border-navy"
          />
          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
          <Button type="submit" variant="outline" className="w-full" disabled={!token.trim() || checking}>
            {checking ? "Checking…" : "Open dashboard"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          API: <span className="font-mono">{shownApi}</span>
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
    </svg>
  );
}
