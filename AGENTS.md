<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Rapid Bet — engineering notes

Middleware is now `proxy.ts`. `cookies()` is async. Server Actions still use `"use server"`.

## Service architecture

All vendor integrations live behind typed interfaces in `src/lib/services/`. Import the
singleton (`notifier`, `payment`, `kyc`, `email`, `push`, `storage`, `data`, `realMoneyGeo`)
from `@/lib/services` — never reach into a vendor SDK directly from a page or action.

Each adapter is configured via `src/lib/services/config.ts`, which reads only from env.
If a vendor's key is missing, the adapter no-ops with a clear log line so the app keeps
working in Phase 1 without external credentials.

## Hard gates that never come down

- `REAL_MONEY_ENABLED=false` by default. Every money path checks this at runtime.
- `PERMITTED_STATES=[]` until counsel populates it. The real-money geo provider blocks
  every check until a vendor is wired AND the state list is non-empty.
- KYC `status === verified` AND age `>=` jurisdiction minimum are required for any
  real-money entry/deposit/withdrawal.

Phase 1 (free-to-play) bypasses all three because no money moves.

## One-time vendor setup checklist

Items below are dashboard work the code cannot do for you. Copy keys into `.env.local`
for dev and into Vercel env vars for prod.

### Supabase (already live)
1. Storage → **New bucket** → name `kyc-artifacts` → **Private**. Used for KYC artifacts only.
2. Storage → **New bucket** → name `public-assets` → Public. For avatars, og images, etc.
3. SQL Editor → paste `drizzle/rls.sql` → Run. Enables Row Level Security on every table.

### Resend (transactional email)
1. resend.com → sign up → create API key → `RESEND_API_KEY`.
2. Add and verify a sending domain (SPF + DKIM in DNS). Until verified, sends come from
   `onboarding@resend.dev`.
3. Webhooks → add endpoint `https://<your-app>/api/webhooks/resend` → copy signing
   secret → `RESEND_WEBHOOK_SECRET`.

### Firebase Cloud Messaging (push)
1. console.firebase.google.com → New project.
2. Project settings → Cloud Messaging → enable the API.
3. Project settings → Service accounts → **Generate new private key** → download JSON.
4. Paste full JSON as `FIREBASE_SERVICE_ACCOUNT_JSON` OR split into `FIREBASE_PROJECT_ID`,
   `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
5. Client (TODO next session): wire `getMessaging` + `getToken` + POST token to
   `/api/fcm/register`. iOS needs APNs setup in the Firebase project.

### Trustly (deposits + withdrawals — Phase 2 sandbox)
1. Sign up for Trustly merchant sandbox.
2. Generate merchant RSA keypair. Upload the **public** key in Trustly's dashboard; keep
   the **private** key in `TRUSTLY_PRIVATE_KEY`.
3. Download Trustly's **public** key → `TRUSTLY_PUBLIC_KEY`.
4. Set `TRUSTLY_NOTIFICATION_URL` to `https://<your-app>/api/webhooks/trustly`.
5. Confirm method shape against current Trustly JSON-RPC 2.0 docs before flipping
   `REAL_MONEY_ENABLED=true`. The adapter has `TODO(vendor)` markers where the spec
   needs a final pass.

### Didit (KYC — Phase 2 sandbox)
1. Sign up at didit.me → create app → `DIDIT_API_KEY`.
2. Configure webhook URL `https://<your-app>/api/webhooks/didit` → copy HMAC secret →
   `DIDIT_WEBHOOK_SECRET`.
3. Confirm header name + signing algorithm against current Didit /v3 docs.

### Real-money data feed (TODO — pre-Phase-2)
- Unwired. DataProvider stub returns null, forcing admin manual-settle. Pick SLA-backed
  vendor (Sportradar / DataFeeds / Genius Sports), wire in `src/lib/services/data/`,
  and flip `slaBacked: true` on the result. The settle guard refuses real-money settle
  unless `slaBacked === true`.

### Real-money geo (TODO — pre-Phase-2)
- `realMoneyGeoProvider` returns `blocked` on every call until a vendor is wired.

## Webhook routes
| Vendor       | Path                          | Signature                   |
|--------------|-------------------------------|-----------------------------|
| Resend       | `POST /api/webhooks/resend`   | svix                        |
| Trustly      | `POST /api/webhooks/trustly`  | RSA-SHA1 (Trustly pubkey)   |
| Didit        | `POST /api/webhooks/didit`    | HMAC-SHA256                 |
| FCM register | `POST /api/fcm/register`      | session cookie (server)     |
