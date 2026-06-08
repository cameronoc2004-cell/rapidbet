import { NextResponse } from "next/server";

// Apple App Site Association (AASA) file.
//
// iOS reads this from https://rallypot.org/.well-known/apple-app-site-association
// when the Rallypot Capacitor app is installed. Any link tapped on iOS that
// matches one of the paths below — email confirmation links from Mail,
// rallypot.org URLs in Messages, etc. — gets routed into the app instead
// of opening Safari.
//
// Requirements Apple enforces:
// - Served at exactly this path, no redirect.
// - Content-Type must be application/json (NOT octet-stream).
// - Returned over HTTPS.
// - File body itself is plain JSON; no .json extension on the URL.
//
// appID format: <TEAMID>.<bundle-id>
//   TEAMID = 6P9BS5RVV3 (Cameron O'Connell)
//   bundle = org.rallypot.app
//
// "*" matches every path under the domain — anything the user taps lands
// in the app. If we ever want to keep some routes web-only (legal pages,
// landing pages), we can switch to a whitelist of paths.
const AASA = {
  applinks: {
    apps: [],
    details: [
      {
        appIDs: ["6P9BS5RVV3.org.rallypot.app"],
        components: [{ "/": "*" }],
      },
    ],
  },
} as const;

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(AASA, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
