// Browser-only Firebase init. Never import this from a server file —
// firebase/messaging touches window + service workers.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  type Messaging,
} from "firebase/messaging";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

function getApp(): FirebaseApp {
  if (app) return app;
  app = getApps()[0] ?? initializeApp(config);
  return app;
}

export function firebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.messagingSenderId && VAPID_KEY);
}

// Returns a registration token, or throws a typed error code.
export async function registerPushToken(): Promise<string> {
  if (!firebaseConfigured()) throw new Error("not_configured");
  if (typeof window === "undefined") throw new Error("not_in_browser");
  if (!(await isSupported())) throw new Error("unsupported");

  // Permission must be requested in response to a user gesture.
  const perm = await Notification.requestPermission();
  if (perm === "denied") throw new Error("denied");
  if (perm !== "granted") throw new Error("dismissed");

  // FCM requires a service worker at /firebase-messaging-sw.js.
  const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/",
  });

  if (!messaging) messaging = getMessaging(getApp());

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: swReg,
  });
  if (!token) throw new Error("no_token");
  return token;
}
