// Mint a Supabase-shaped HS256 JWT for local testing (mirrors tests/conftest.py make_jwt in the backend).
// Usage: node scripts/dev-token.mjs <SUPABASE_JWT_SECRET> [email] [name]
import { createHmac, randomUUID } from "node:crypto";

const [secret, email = "dev@example.com", name = "Dev User"] = process.argv.slice(2);
if (!secret) {
  console.error("usage: node scripts/dev-token.mjs <SUPABASE_JWT_SECRET> [email] [name]");
  process.exit(1);
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const claims = {
  sub: randomUUID(),
  aud: "authenticated",
  role: "authenticated",
  email,
  iat: now,
  exp: now + 60 * 60 * 24,
  user_metadata: { full_name: name, email, avatar_url: null },
};
const head = b64({ alg: "HS256", typ: "JWT" });
const body = b64(claims);
const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
console.log(`${head}.${body}.${sig}`);
