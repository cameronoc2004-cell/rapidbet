// =============================================================================
// Central vendor config. EVERY env var lives here so missing-key checks are in
// one place and adapters can no-op cleanly when not configured.
//
// Defaults to the safe/closed state for anything money-adjacent.
// =============================================================================

export const services = {
  resend: {
    apiKey: process.env.RESEND_API_KEY ?? "",
    fromAddress: process.env.RESEND_FROM ?? "Rallypot <onboarding@resend.dev>",
    // Resend's signing secret for the bounce/complaint webhook.
    webhookSecret: process.env.RESEND_WEBHOOK_SECRET ?? "",
  },
  fcm: {
    // Either set FIREBASE_SERVICE_ACCOUNT_JSON (the full JSON blob) or the
    // three split env vars below. Split form is easier in Vercel's UI because
    // multiline secrets sometimes confuse the dashboard.
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "",
    projectId: process.env.FIREBASE_PROJECT_ID ?? "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? "",
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  },
  trustly: {
    env: (process.env.TRUSTLY_ENV ?? "sandbox") as "sandbox" | "production",
    username: process.env.TRUSTLY_USERNAME ?? "",
    password: process.env.TRUSTLY_PASSWORD ?? "",
    // Merchant private key — signs outgoing requests.
    privateKeyPem: (process.env.TRUSTLY_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    // Trustly's public key — verifies inbound webhook signatures.
    trustlyPublicKeyPem: (process.env.TRUSTLY_PUBLIC_KEY ?? "").replace(/\\n/g, "\n"),
    notificationUrl: process.env.TRUSTLY_NOTIFICATION_URL ?? "",
  },
  didit: {
    env: (process.env.DIDIT_ENV ?? "sandbox") as "sandbox" | "production",
    apiKey: process.env.DIDIT_API_KEY ?? "",
    // Used to verify webhook HMAC signatures.
    webhookSecret: process.env.DIDIT_WEBHOOK_SECRET ?? "",
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
    serviceKey: process.env.SUPABASE_SECRET_KEY ?? "",
    // Buckets we expect to exist (create in dashboard).
    kycBucket: process.env.SUPABASE_KYC_BUCKET ?? "kyc-artifacts",
    publicBucket: process.env.SUPABASE_PUBLIC_BUCKET ?? "public-assets",
  },
};

export function isResendConfigured(): boolean {
  return !!services.resend.apiKey;
}
export function isFcmConfigured(): boolean {
  if (services.fcm.serviceAccountJson) return true;
  return (
    !!services.fcm.projectId &&
    !!services.fcm.clientEmail &&
    !!services.fcm.privateKey
  );
}
export function isTrustlyConfigured(): boolean {
  return (
    !!services.trustly.username &&
    !!services.trustly.password &&
    !!services.trustly.privateKeyPem
  );
}
export function isDiditConfigured(): boolean {
  return !!services.didit.apiKey;
}
