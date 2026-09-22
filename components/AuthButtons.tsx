"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ButtonLink, Button } from "./Button";
import { api, getToken, setToken } from "@/lib/api";

// Session lives in localStorage, so this must resolve on the client after mount.
// Until then we render the logged-out set, which also matches the server HTML.
export function AuthButtons() {
  const router = useRouter();
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSignedIn(!!getToken());
  }, [pathname]);

  function logout() {
    void api("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    setToken(null);
    setSignedIn(false);
    router.push("/");
  }

  if (signedIn) {
    const onDashboard = pathname.startsWith("/dashboard");
    return (
      <div className="flex items-center gap-2">
        <ButtonLink href="/dashboard" variant={onDashboard ? "outline" : "dark"} size="sm">
          Dashboard
        </ButtonLink>
        <Button variant="ghost" size="sm" onClick={logout}>
          Log out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
        Log in
      </ButtonLink>
      <ButtonLink href="/pricing#enterprise" variant="outline" size="sm" className="hidden sm:inline-flex">
        Talk to sales
      </ButtonLink>
      <ButtonLink href="/login" variant="dark" size="sm">
        Get started free
      </ButtonLink>
    </div>
  );
}
