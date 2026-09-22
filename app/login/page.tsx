import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

// Read on the server on every request; NEXT_PUBLIC_* inlining into the client
// bundle is skipped entirely so a stale dev cache cannot desync server/client.
export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/login">) {
  const { reason } = await props.searchParams;
  return (
    <LoginForm
      supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? null}
      reason={typeof reason === "string" ? reason : null}
    />
  );
}
