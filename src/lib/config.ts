// App-wide constants. Tweak the team name here while the MVP only covers one franchise.
export const TEAM_NAME = process.env.NEXT_PUBLIC_TEAM_NAME ?? "Home Team";

// Starter virtual currency given on signup (play money).
export const SIGNUP_GC_BONUS = 100;
export const SIGNUP_SC_BONUS = 5;

// Admin gate. MVP only — replace with real RBAC before any real money flows.
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "letmein";

// Cookie signing secret. MUST be overridden in production via env.
export const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-not-secure";
