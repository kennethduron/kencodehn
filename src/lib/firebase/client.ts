import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

export type FirebaseClientConfigStatus =
  | { ok: true; app: FirebaseApp; auth: Auth }
  | { ok: false; missing: string[] };

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getFirebaseClient(): FirebaseClientConfigStatus {
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => `NEXT_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  const app = getApps().length
    ? getApp()
    : initializeApp({
        ...(config as Required<typeof config>),
        ...(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? { messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID } : {}),
      });
  return {
    ok: true,
    app,
    auth: getAuth(app),
  };
}
