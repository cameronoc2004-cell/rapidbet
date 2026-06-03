// =============================================================================
// Vendor adapter interfaces. Every concrete implementation in this folder
// implements one of these. App code imports the interface and uses the
// singleton from ./index — never reaches into a vendor SDK directly.
// =============================================================================

// --------- Auth ---------
export interface AuthUserSummary {
  authUserId: string;
  email: string | null;
  emailConfirmedAt: Date | null;
}

export interface AuthProvider {
  // Read the current session's user from the server context (cookies). Returns
  // null when no one is signed in. The actual SupabaseAuth implementation uses
  // @supabase/ssr cookies under the hood.
  getCurrentAuthUser(): Promise<AuthUserSummary | null>;
}

// --------- Storage ---------
export interface StorageProvider {
  // Upload to a bucket; key is the path within the bucket.
  uploadPrivate(input: {
    bucket: string;
    key: string;
    body: Buffer | Uint8Array | Blob;
    contentType?: string;
  }): Promise<void>;
  // Issue a short-lived signed URL for an object in a private bucket.
  signedUrl(input: { bucket: string; key: string; ttlSeconds: number }): Promise<string>;
  deleteObject(input: { bucket: string; key: string }): Promise<void>;
}

// --------- Email ---------
export type EmailTemplate =
  | "email_verification"
  | "password_reset"
  | "deposit_confirmed"
  | "withdrawal_initiated"
  | "withdrawal_completed"
  | "contest_won"
  | "rg_limit_reached"
  | "rg_self_exclusion_confirm";

export interface EmailSendInput {
  to: string;
  template: EmailTemplate;
  // Structured data for the template; shape is template-specific.
  data: Record<string, unknown>;
}

export interface EmailProvider {
  send(input: EmailSendInput): Promise<{ vendorRef: string | null; skipped: boolean }>;
}

// --------- Push (FCM) ---------
export interface PushPayload {
  title: string;
  body: string;
  // Optional client-side route to navigate to when tapped.
  url?: string;
  // Free-form extra fields delivered to client.
  data?: Record<string, string>;
}

export interface PushProvider {
  send(input: { userId: number; payload: PushPayload }): Promise<{
    sent: number;
    pruned: number;
  }>;
}

// --------- Notifier (composed) ---------
// High-level event emitters. Implementations decide which channel(s) to use
// per event and honor per-user notification prefs.
export interface Notifier {
  notifyContestWon(input: {
    userId: number;
    amountMinor: number;
    questionTitle: string;
  }): Promise<void>;
  notifyResultsPosted(input: {
    userId: number;
    questionTitle: string;
    won: boolean;
  }): Promise<void>;
  notifyDepositConfirmed(input: {
    userId: number;
    amountMinor: number;
  }): Promise<void>;
  notifyWithdrawalInitiated(input: {
    userId: number;
    amountMinor: number;
  }): Promise<void>;
  notifyWithdrawalCompleted(input: {
    userId: number;
    amountMinor: number;
  }): Promise<void>;
  notifyResponsibleGaming(input: {
    userId: number;
    kind: "limit_reached" | "self_exclusion_confirm";
    data?: Record<string, unknown>;
  }): Promise<void>;
}

// --------- Payment (Trustly) ---------
export interface DepositInitiateResult {
  vendor: string;
  vendorOrderId: string;
  hostedCheckoutUrl: string;
}

export interface WithdrawalInitiateResult {
  vendor: string;
  vendorOrderId: string;
  status: "pending";
}

export interface PaymentProvider {
  // Create a deposit checkout. Returns a hosted URL the user is redirected to.
  // NEVER call this from a UI without first checking REAL_MONEY_ENABLED, KYC,
  // and the real-money geo gate.
  deposit(input: {
    userId: number;
    amountMinor: number;
  }): Promise<DepositInitiateResult>;

  // Start a withdrawal. Real money is debited from wallet immediately; payment
  // vendor confirms async via webhook. On webhook fail, the debit is reversed.
  withdraw(input: {
    userId: number;
    amountMinor: number;
  }): Promise<WithdrawalInitiateResult>;

  // Refund a previous deposit (used when a related contest is voided).
  refund(input: { vendorOrderId: string }): Promise<{ status: "queued" }>;
}

// --------- KYC (Didit) ---------
export type KycDecision = "approved" | "declined" | "pending" | "expired";

export interface KycCreateSessionResult {
  vendor: string;
  vendorRef: string;
  hostedUrl: string;
}

export interface KycSummary {
  status: KycDecision | "none";
  ageEligible: boolean | null;
  jurisdiction: string | null;
  verifiedAt: Date | null;
}

export interface KycProvider {
  createSession(input: { userId: number; email: string }): Promise<KycCreateSessionResult>;
  // Read the user's latest decision (from our DB, not the vendor).
  getStatus(userId: number): Promise<KycSummary>;
}

// --------- Data feed (sports results) ---------
// Phase 1: pointed at a free feed (balldontlie or similar) for display +
// free-to-play settling. Phase 2 SLA-backed feed (Sportradar / DataFeeds /
// Genius Sports) is required before settling REAL money. The settle code
// guard refuses real-money settle if data.vendor !== "sla_backed".
export interface OfficialResult {
  value: number;
  vendor: string;
  vendorRef: string | null;
  payload: Record<string, unknown> | null;
  fetchedAt: Date;
  // True only if vendor is contractually SLA'd. Phase 1 stub is always false.
  slaBacked: boolean;
}

export interface DataProviderQuestionContext {
  league: string;
  statType: string;
  subject: string;
  window: string;
  gameExternalRef?: string | null;
}

export interface DataProvider {
  // Returns the official result for a settled question, or null if the data
  // isn't available yet (caller should retry).
  fetchOfficialResult(ctx: DataProviderQuestionContext): Promise<OfficialResult | null>;
}

// --------- Real-money geo gate ---------
// Distinct from the Census state-verification used at onboarding for free
// play. This one runs PER REAL-MONEY ACTION (deposit, entry, withdrawal) and
// must use a vendor that provides anti-spoof / anti-VPN signals.
export type RealMoneyGeoResult = "permitted" | "blocked" | "unknown";

export interface RealMoneyGeoProvider {
  check(input: {
    userId: number;
    // Vendor SDK token (e.g. GeoComply attestation) or coords.
    attestation?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<{ result: RealMoneyGeoResult; reason?: string }>;
}
