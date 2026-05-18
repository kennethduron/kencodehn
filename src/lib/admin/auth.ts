import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import type { AdminUser } from "@/lib/admin/types";

export const CRM_SESSION_COOKIE = "kc_crm_session";
const SESSION_DAYS = 5;

function getAllowedEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getMissingAdminEnv() {
  const missing: string[] = [];
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY)) {
    missing.push("FIREBASE_SERVICE_ACCOUNT_KEY");
  }
  if (!process.env.ADMIN_EMAILS) {
    missing.push("ADMIN_EMAILS");
  }
  return missing;
}

export function getMissingFirebaseClientEnv() {
  return [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ].filter((key) => !process.env[key]);
}

export function isEmailAllowed(email?: string | null) {
  if (!email) {
    return false;
  }
  return getAllowedEmails().includes(email.toLowerCase());
}

export function getSessionMaxAge() {
  return SESSION_DAYS * 24 * 60 * 60;
}

export async function createCrmSession(idToken: string) {
  const auth = getAdminAuth();
  if (!auth) {
    return { ok: false as const, status: 500, message: "Firebase Admin no esta configurado." };
  }

  const decodedToken = await auth.verifyIdToken(idToken);
  if (!isEmailAllowed(decodedToken.email)) {
    return { ok: false as const, status: 403, message: "Este correo no esta autorizado para entrar al CRM." };
  }

  const expiresIn = getSessionMaxAge() * 1000;
  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

  const db = getAdminDb();
  if (db && decodedToken.email) {
    const now = new Date().toISOString();
    await db.collection("adminUsers").doc(decodedToken.uid).set(
      {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: "owner",
        active: true,
        lastLoginAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
  }

  return {
    ok: true as const,
    sessionCookie,
    maxAge: getSessionMaxAge(),
    admin: {
      uid: decodedToken.uid,
      email: decodedToken.email ?? "",
      role: "owner" as const,
    },
  };
}

export async function verifyCrmSession(sessionCookie: string | undefined | null): Promise<AdminUser | null> {
  if (!sessionCookie) {
    return null;
  }

  const auth = getAdminAuth();
  if (!auth) {
    return null;
  }

  try {
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    if (!isEmailAllowed(decoded.email)) {
      return null;
    }

    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      role: "owner",
    };
  } catch {
    return null;
  }
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  return verifyCrmSession(cookieStore.get(CRM_SESSION_COOKIE)?.value);
}

export async function requireAdminFromRequest(request: NextRequest) {
  return verifyCrmSession(request.cookies.get(CRM_SESSION_COOKIE)?.value);
}
