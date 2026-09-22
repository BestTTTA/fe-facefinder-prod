// Thin client for be-ml-facefinder-full. Every response is wrapped in
// { success, data, meta } or { success: false, error: { code, message } }.

/** The configured backend base. Same value on the server and in the browser, so
 *  it is safe to render (no hydration mismatch). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** The base actually used for requests, resolved per call in the browser.
 *  When the page is served from somewhere other than localhost (a phone on the
 *  LAN, a tunnel) a localhost API address means nothing to that browser, so we
 *  use this origin instead — next.config.ts proxies /api to the backend. */
export function apiBase(): string {
  if (typeof window === "undefined") return API_URL;
  const servedLocally = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  const apiIsLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(API_URL);
  return !servedLocally && apiIsLocal ? "" : API_URL;
}

const TOKEN_KEY = "ff_access_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type Envelope<T> =
  | { success: true; data: T; meta?: unknown }
  | { success: false; error: { code: string; message: string; details?: unknown } };

export type ApiResult<T> = {
  data: T;
  meta?: unknown;
  status: number;
  requestId: string | null;
  rateLimit: { limit: string | null; remaining: string | null; reset: string | null };
  ms: number;
};

type ApiInit = RequestInit & {
  /** Authenticate with an integration key (X-API-Key) instead of the user session. */
  apiKey?: string;
  /** Use this bearer token instead of the stored user session (admin sessions). */
  bearer?: string;
};

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  return (await apiFull<T>(path, init)).data;
}

/** Like api() but also returns status, meta and rate-limit headers (for the playground). */
export async function apiFull<T>(
  path: string,
  { apiKey, bearer, ...init }: ApiInit = {},
): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  if (apiKey) headers.set("X-API-Key", apiKey);
  else {
    const token = bearer ?? getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const started = performance.now();
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, { ...init, headers });
  } catch {
    // TypeError "Failed to fetch": server down, or CORS rejected this origin.
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      `Cannot reach ${apiBase() || window.location.origin} — is the API running, and does its CORS_ORIGINS include ${
        typeof window === "undefined" ? "this origin" : window.location.origin
      }?`,
    );
  }
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!body || !body.success) {
    const err = body && !body.success ? body.error : null;
    throw new ApiError(
      res.status,
      err?.code ?? "HTTP_ERROR",
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
    );
  }
  return {
    data: body.data,
    meta: body.meta,
    status: res.status,
    requestId: res.headers.get("X-Request-ID"),
    rateLimit: {
      limit: res.headers.get("X-RateLimit-Limit"),
      remaining: res.headers.get("X-RateLimit-Remaining"),
      reset: res.headers.get("X-RateLimit-Reset"),
    },
    ms: Math.round(performance.now() - started),
  };
}

export type Profile = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  status: string;
  role: string;
  tenant_id: string;
};

export type PackageOut = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_cycle: string;
  upload_limit: number;
  search_limit: number;
  storage_limit: number;
  max_users: number;
  api_rate_limit: number;
  is_active?: boolean;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  api_key?: string; // only on create / rotate
};

export type QuotaItem = { used: number; limit: number | null; remaining: number | null; unlimited?: boolean };
export type Usage = {
  package: { id: string; name: string };
  subscription: { status: string; started_at: string | null; expired_at: string | null };
  period: { start: string; end: string };
  uploads: QuotaItem;
  searches: QuotaItem;
  storage: QuotaItem;
  api_requests: { used: number; rate_limit_per_minute: number };
};
export type UsagePeriod = {
  period_start: string;
  period_end: string;
  upload_count: number;
  search_count: number;
  storage_used: number;
  api_request_count: number;
};

export const SCOPES = [
  "faces:upload",
  "faces:search",
  "faces:read",
  "persons:read",
] as const;

export type PersonOut = {
  id: string;
  external_user_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  department: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  face_count?: number | null;
};

export type FaceOut = {
  id: string;
  person_id: string;
  image_id: string;
  bbox: Record<string, number>;
  det_score: number | null;
  model: string;
  created_at: string;
  image_url: string | null;
  thumbnail_url: string | null;
};

export type UploadOut = {
  face: FaceOut;
  person: PersonOut;
  image: { id: string; mime_type: string; size_bytes: number; width: number; height: number };
  processing_time_ms: number;
};

export type SearchOut = {
  match: boolean;
  confidence: number;
  similarity: number | null;
  person: PersonOut | null;
  face_id: string | null;
  candidates: Array<Record<string, unknown>>;
  threshold: number;
  query: Record<string, unknown>;
  processing_time_ms: number;
};
