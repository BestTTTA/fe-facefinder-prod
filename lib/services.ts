// Mirrors what be-ml-facefinder-full exposes under /api/v1.

export type Service = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  method: "POST" | "GET" | "PATCH" | "DELETE";
  path: string;
  scope: string;
  bullets: string[];
};

export const SERVICES: Service[] = [
  {
    id: "register",
    name: "Face Register",
    tagline: "Enroll a person from a single photo",
    description:
      "Upload an image with an external_user_id, name and free-form metadata. We detect the face, compute a 512-d ArcFace embedding and store it in your tenant's private index.",
    method: "POST",
    path: "/api/v1/faces",
    scope: "faces:upload",
    bullets: [
      "InsightFace buffalo_l · 512-d embeddings",
      "Idempotency-Key support, duplicate image detection",
      "Rejects NO_FACE / MULTIPLE_FACES with clear error codes",
      "Quota consumed only on success",
    ],
  },
  {
    id: "search",
    name: "Face Search",
    tagline: "Who is this? — answered in ~400 ms",
    description:
      "Send a query photo and get back the best matching person, a calibrated confidence score, cosine similarity and top-K candidates. Search never crosses tenants.",
    method: "POST",
    path: "/api/v1/faces/search",
    scope: "faces:search",
    bullets: [
      "pgvector HNSW index, cosine similarity",
      "Logistic confidence calibrated around threshold",
      "Top-K candidates with person metadata",
      "processing_time_ms in every response",
    ],
  },
  {
    id: "persons",
    name: "Persons & Faces",
    tagline: "Manage the people you've enrolled",
    description:
      "List, read, update and delete persons and their faces. Images are stored in a private bucket and only ever exposed through short-lived signed URLs.",
    method: "GET",
    path: "/api/v1/persons",
    scope: "persons:read · faces:read",
    bullets: [
      "Search persons by name / external id",
      "Signed original + thumbnail URLs (with_urls=true)",
      "Soft-delete with audit logs",
      "Pagination with limit / offset",
    ],
  },
  {
    id: "keys",
    name: "API Keys",
    tagline: "Scoped, expiring, rotatable",
    description:
      "Create fr_live_… keys scoped to exactly the operations an integration needs. Rotate without downtime, revoke instantly, and see last_used_at per key.",
    method: "POST",
    path: "/api/v1/me/api-keys",
    scope: "user session",
    bullets: [
      "Scopes: faces:upload, faces:search, faces:read, persons:read",
      "Optional expiry date",
      "One-click rotate & revoke",
      "Sent as X-API-Key or Bearer",
    ],
  },
  {
    id: "usage",
    name: "Usage & Quota",
    tagline: "Know exactly what you've spent",
    description:
      "Per-calendar-month usage periods for uploads, searches and storage, plus immutable logs for every call. Atomic quota checks mean concurrent requests can never overspend.",
    method: "GET",
    path: "/api/v1/me/usage",
    scope: "user session",
    bullets: [
      "used / limit / remaining per resource",
      "12-month usage history",
      "X-RateLimit-* headers on every request",
      "Storage carries over between periods",
    ],
  },
];

export type Package = {
  name: string;
  description: string;
  price: number; // USD / month
  uploadLimit: number; // -1 = unlimited
  searchLimit: number;
  storageBytes: number;
  rateLimit: number; // req / min
  maxUsers: number;
  highlight?: boolean;
  cta: string;
};

const GB = 1024 ** 3;
const MB = 1024 ** 2;

// Seeded in migrations/versions/0001_initial_schema.py of the backend.
export const PACKAGES: Package[] = [
  {
    name: "Free",
    description: "Free tier for evaluation",
    price: 0,
    uploadLimit: 100,
    searchLimit: 100,
    storageBytes: 500 * MB,
    rateLimit: 10,
    maxUsers: 1,
    cta: "Start free",
  },
  {
    name: "Basic",
    description: "Small teams",
    price: 29,
    uploadLimit: 1_000,
    searchLimit: 1_000,
    storageBytes: 5 * GB,
    rateLimit: 60,
    maxUsers: 3,
    cta: "Choose Basic",
  },
  {
    name: "Pro",
    description: "Production workloads",
    price: 99,
    uploadLimit: 10_000,
    searchLimit: 10_000,
    storageBytes: 50 * GB,
    rateLimit: 300,
    maxUsers: 10,
    highlight: true,
    cta: "Choose Pro",
  },
  {
    name: "Enterprise",
    description: "Custom limits — contact sales",
    price: -1,
    uploadLimit: -1,
    searchLimit: -1,
    storageBytes: -1,
    rateLimit: 1000,
    maxUsers: -1,
    cta: "Talk to sales",
  },
];

// Packages use -1 for unlimited; /me/usage entries use null.
export function fmtLimit(n: number | null | undefined, unit = "") {
  if (n == null || n === -1) return "Unlimited";
  return `${n.toLocaleString()}${unit}`;
}

export function fmtBytes(b: number | null | undefined) {
  if (b == null || b === -1) return "Unlimited";
  if (b >= GB) return `${b / GB} GB`;
  return `${Math.round(b / MB)} MB`;
}
