import "server-only";

import { createRequire } from "node:module";
import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import type { Messaging } from "firebase-admin/messaging";

const requireFirebaseAdmin = createRequire(import.meta.url);
let app: App | null = null;
let firestore: Firestore | null = null;
let auth: Auth | null = null;
let messaging: Messaging | null = null;

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch (error) {
      console.warn("[Ken Code Firebase config warning] Invalid FIREBASE_SERVICE_ACCOUNT_KEY JSON.", error);
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function getAdminApp() {
  if (app) return app;
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) return null;
  const { cert, getApps, initializeApp } = requireFirebaseAdmin("firebase-admin/app") as typeof import("firebase-admin/app");
  app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
  return app;
}

export function getAdminProjectId() {
  return getAdminApp()?.options.projectId ?? null;
}

export function getAdminDb() {
  if (firestore) {
    return firestore;
  }

  try {
    const currentApp = getAdminApp();
    if (!currentApp) return null;
    const { getFirestore } = requireFirebaseAdmin("firebase-admin/firestore") as typeof import("firebase-admin/firestore");
    firestore = getFirestore(currentApp);
    return firestore;
  } catch (error) {
    console.warn("[Ken Code Firebase config warning] Unable to initialize Firebase Admin.", error);
    return null;
  }
}

export function getAdminServerTimestamp() {
  const { FieldValue } = requireFirebaseAdmin("firebase-admin/firestore") as typeof import("firebase-admin/firestore");
  return FieldValue.serverTimestamp();
}

export function getAdminAuth() {
  if (auth) {
    return auth;
  }

  try {
    const currentApp = getAdminApp();
    if (!currentApp) return null;
    const { getAuth } = requireFirebaseAdmin("firebase-admin/auth") as typeof import("firebase-admin/auth");
    auth = getAuth(currentApp);
    return auth;
  } catch (error) {
    console.warn("[Ken Code Firebase Auth warning] Unable to initialize Firebase Admin Auth.", error);
    return null;
  }
}

export function getAdminMessaging() {
  if (messaging) {
    return messaging;
  }

  try {
    const currentApp = getAdminApp();
    if (!currentApp) return null;
    const { getMessaging } = requireFirebaseAdmin("firebase-admin/messaging") as typeof import("firebase-admin/messaging");
    messaging = getMessaging(currentApp);
    return messaging;
  } catch (error) {
    console.warn("[Ken Code Firebase Messaging warning] Unable to initialize Firebase Admin Messaging.", error);
    return null;
  }
}
