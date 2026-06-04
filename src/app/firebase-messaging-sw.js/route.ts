import { NextResponse } from "next/server";

// Serve the Firebase Cloud Messaging service worker at /firebase-messaging-sw.js
// (FCM REQUIRES this exact path at the site root). Public Firebase web config
// is interpolated at request time so we don't have to keep a static .js file
// in sync with env. All inlined values are NEXT_PUBLIC_ — safe to expose.

export const dynamic = "force-static";    // safe — only depends on env at build
export const revalidate = 60;             // bust if env rotates

export function GET() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };

  // Using the compat SDK in the SW because importScripts is the canonical
  // pattern for FCM service workers — much simpler than bundling modular ESM
  // through a separate webpack config.
  const sw = `
/* eslint-disable */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(cfg)});
const messaging = firebase.messaging();

// Background message handler. When the page is closed or backgrounded, FCM
// delivers the payload here; we show a native notification.
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "Rallypot";
  const body  = (payload.notification && payload.notification.body)  || "";
  const url   = (payload.data && payload.data.url) || "/";
  self.registration.showNotification(title, {
    body: body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: url },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(clients.openWindow(url));
});

// PWA installability needs a service worker that handles install + fetch.
// We don't actually want to cache anything (Next handles HTTP caching well),
// but the events must exist for the install prompt to fire.
self.addEventListener("install", (event) => { self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", (event) => { /* pass through */ });
`.trim();

  return new NextResponse(sw, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // FCM scope must be the root; explicit header lets the SW be registered with scope:"/"
      "Service-Worker-Allowed": "/",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
