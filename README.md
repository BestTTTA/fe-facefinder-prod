# fe-facefinder-prod

Customer portal for the FaceFinder face recognition API ([be-ml-facefinder-full](https://github.com/BestTTTA)).
Marketing site, API docs, a playground for trying the API, a customer dashboard and an admin console.

Built with Next.js 16 (App Router), React 19 and Tailwind CSS 4.

## Pages

| Route | What it is |
|---|---|
| `/` | Landing page — services, how it works, pricing, security |
| `/pricing` | Package comparison (Free / Basic / Pro / Enterprise) and FAQ |
| `/docs` | API reference: auth, response envelope, every endpoint, error codes |
| `/playground` | Try the API with an API key: register a face, search, browse persons |
| `/playground/video` | Scan a photo, a video file or the live camera — detects several faces per frame and shows each match with their registered photo and metadata |
| `/login` | Google sign-in (Supabase) or paste an access token |
| `/dashboard` | Quota meters, package, usage history, API key management |
| `/dashboard/people` | Registered people: view photos, edit details, delete (single or bulk) |
| `/admin` | Admin console: platform stats |
| `/admin/users` | Users: change package, role and status, browse faces / uploads / searches, delete |
| `/admin/packages` | Create and edit packages (limits, price, rate limit) |
| `/admin/audit-logs` | Every admin action |

Admin sessions are separate from customer sessions; `/admin/login` uses the API's
`ADMIN_BOOTSTRAP_USERNAME` account.

## Running locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

The API must be running (default `http://localhost:8000`).

### Environment

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL. Defaults to `http://localhost:8000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL — enables "Continue with Google" |
| `NEXT_PUBLIC_SITE_URL` | Public site URL, used for absolute Open Graph / canonical URLs |
| `API_PROXY_TARGET` | Server-side proxy target for `/api/*` (defaults to `NEXT_PUBLIC_API_URL`'s default) |

`next.config.ts` proxies `/api/*` to the backend, so the browser only ever talks to
this origin — no CORS setup is needed, and the portal works unchanged from a phone
or a tunnel.

## Face detection in the browser

`/playground/video` detects faces locally with MediaPipe BlazeFace, then sends one
crop per face to `POST /faces/search` (the API matches one face per request). The
WASM runtime and the model are served from `public/mediapipe/` so nothing is fetched
from a CDN at runtime.

## Checks

```bash
npx tsc --noEmit -p .   # types
npx eslint .            # lint
npm run build           # production build
```
