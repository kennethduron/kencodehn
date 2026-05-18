import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let firestore: Firestore | null = null;
let auth: Auth | null = null;

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

export function getAdminDb() {
  if (firestore) {
    return firestore;
  }

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    return null;
  }

  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    }

    firestore = getFirestore();
    return firestore;
  } catch (error) {
    console.warn("[Ken Code Firebase config warning] Unable to initialize Firebase Admin.", error);
    return null;
  }
}

export function getAdminAuth() {
  if (auth) {
    return auth;
  }

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    return null;
  }

  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    }

    auth = getAuth();
    return auth;
  } catch (error) {
    console.warn("[Ken Code Firebase Auth warning] Unable to initialize Firebase Admin Auth.", error);
    return null;
  }
}
