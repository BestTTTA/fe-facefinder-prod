// Admin sessions are separate from user sessions (backend: /api/v1/admin/auth/*).

import { ApiError, apiFull, type ApiResult, type PackageOut } from "./api";

const ADMIN_TOKEN_KEY = "ff_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class AdminUnauthenticated extends Error {}

export async function adminApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await adminApiFull<T>(path, init)).data;
}

export async function adminApiFull<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const token = getAdminToken();
  if (!token) throw new AdminUnauthenticated("Not signed in as admin");
  if (init.body && typeof init.body === "string") {
    init.headers = { "Content-Type": "application/json", ...(init.headers as Record<string, string>) };
  }
  try {
    return await apiFull<T>(`/api/v1/admin${path}`, { ...init, bearer: token });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      setAdminToken(null);
      throw new AdminUnauthenticated(e.message);
    }
    throw e;
  }
}

/* ---- shapes returned by app/api/v1/admin.py ---- */

export type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  roles: string[];
  permissions: string[];
  last_login_at: string | null;
};

export type AdminDashboard = {
  users: { total: number; active: number; suspended: number };
  faces: { persons: number; faces: number; images: number };
  today: { uploads: number; searches: number };
  current_period: { start: string; api_requests: number; uploads: number; searches: number };
  package_distribution: Record<string, number>;
  storage: { used_bytes: number };
  generated_at: string;
};

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  status: "active" | "suspended" | string;
  role: "owner" | "member" | string;
  tenant_id: string;
  tenant_status: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  package: { id: string; name: string } | null;
  subscription: { status: string; started_at: string | null; expired_at: string | null } | null;
  counts?: Record<string, number>;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_type: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  created_at: string;
};

export type { PackageOut };

export type AdminFace = {
  id: string;
  person_id: string;
  image_id: string;
  bbox: Record<string, number>;
  det_score: number | null;
  model: string;
  created_at: string;
  image_url?: string | null;
  thumbnail_url?: string | null;
};

export type UploadLogRow = {
  id: string;
  image_id: string | null;
  person_id: string | null;
  file_size: number | null;
  processing_time_ms: number | null;
  status: string;
  error_code: string | null;
  api_key_id: string | null;
  created_at: string;
};

export type SearchLogRow = {
  id: string;
  matched_person_id: string | null;
  similarity: number | null;
  result_count: number | null;
  processing_time_ms: number | null;
  status: string;
  error_code: string | null;
  api_key_id: string | null;
  created_at: string;
};

export const SUBSCRIPTION_STATUSES = ["trial", "active", "past_due", "cancelled", "expired", "suspended"] as const;
