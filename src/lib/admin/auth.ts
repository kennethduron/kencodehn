import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  defaultPermissionsForRole,
  hasEveryPermission,
  isBootstrapOwnerEmail,
  resolveAdminUserFromProfile,
  type AdminPermission,
  type AdminUser,
} from "@/lib/admin/authorization";

export const CRM_SESSION_COOKIE = "kc_crm_session";
const SESSION_DAYS = 5;

export function getMissingAdminEnv() {
  const missing: string[] = [];
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY)) {
    missing.push("FIREBASE_SERVICE_ACCOUNT_KEY");
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

export function getSessionMaxAge() {
  return SESSION_DAYS * 24 * 60 * 60;
}

type AdminProfileResult =
  | { ok: true; admin: AdminUser; created: boolean; invitationPending: boolean }
  | { ok: false; reason: "firebase_not_configured" | "profile_missing" | "profile_inactive" | "profile_invalid" };

async function loadAdminProfile(uid: string, email: string, allowBootstrap: boolean): Promise<AdminProfileResult> {
  const db = getAdminDb();
  if (!db) {
    return { ok: false, reason: "firebase_not_configured" };
  }

  const ref = db.collection("adminUsers").doc(uid);
  let snapshot = await ref.get();

  if (
    !snapshot.exists
    && allowBootstrap
    && isBootstrapOwnerEmail(email, process.env.ADMIN_EMAILS, process.env.CRM_OWNER_EMAILS)
  ) {
    const now = new Date().toISOString();
    try {
      await ref.create({
        uid,
        email: email.toLowerCase(),
        role: "owner",
        permissions: defaultPermissionsForRole("owner"),
        active: true,
        bootstrapCreatedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      snapshot = await ref.get();
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "6" && code !== "already-exists") throw error;
      snapshot = await ref.get();
    }
  }

  if (!snapshot.exists) {
    return { ok: false, reason: "profile_missing" };
  }

  const profile = snapshot.data() ?? {};
  if (profile.active === false) {
    return { ok: false, reason: "profile_inactive" };
  }

  const admin = resolveAdminUserFromProfile({ uid, email, profile });
  if (!admin) {
    return { ok: false, reason: "profile_invalid" };
  }

  return {
    ok: true,
    admin,
    created: Boolean(profile.bootstrapCreatedAt),
    invitationPending: profile.invitationStatus === "pending" || profile.invitationStatus === "sent" || profile.invitationStatus === "failed" || profile.invitationStatus === "email_failed",
  };
}

function profileFailure(reason: Exclude<AdminProfileResult, { ok: true }>["reason"]) {
  if (reason === "firebase_not_configured") {
    return { status: 500, message: "Firebase Admin no esta configurado." };
  }
  if (reason === "profile_inactive") {
    return { status: 403, message: "Tu acceso al CRM esta desactivado." };
  }
  if (reason === "profile_invalid") {
    return { status: 403, message: "Tu perfil administrativo no tiene un rol valido." };
  }
  return { status: 403, message: "Tu perfil administrativo no esta configurado." };
}

export async function createCrmSession(idToken: string) {
  const auth = getAdminAuth();
  if (!auth) {
    return { ok: false as const, status: 500, message: "Firebase Admin no esta configurado." };
  }

  const decodedToken = await auth.verifyIdToken(idToken);
  const email = (decodedToken.email ?? "").toLowerCase();
  const profile = await loadAdminProfile(decodedToken.uid, email, true);
  if (!profile.ok) {
    const failure = profileFailure(profile.reason);
    return { ok: false as const, ...failure };
  }

  const expiresIn = getSessionMaxAge() * 1000;
  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

  const db = getAdminDb();
  if (db) {
    try {
      const lastLoginAt = new Date().toISOString();
      await db.collection("adminUsers").doc(decodedToken.uid).set(
        {
          uid: decodedToken.uid,
          email,
          lastLoginAt,
          ...(profile.invitationPending ? { invitationStatus: "accepted", invitationAcceptedAt: lastLoginAt, invitationError: null } : {}),
        },
        { merge: true },
      );
    } catch (error) {
      console.warn("[Ken Code CRM profile login timestamp warning]", error);
    }
  }

  return {
    ok: true as const,
    sessionCookie,
    maxAge: getSessionMaxAge(),
    admin: profile.admin,
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
    const profile = await loadAdminProfile(decoded.uid, (decoded.email ?? "").toLowerCase(), false);
    return profile.ok ? profile.admin : null;
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

export async function requirePermissionsFromRequest(
  request: NextRequest,
  required: AdminPermission | readonly AdminPermission[],
) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) {
    return { ok: false as const, status: 401 as const, message: "No autorizado." };
  }
  const permissions = Array.isArray(required) ? required : [required];
  if (!hasEveryPermission(admin, permissions)) {
    return { ok: false as const, status: 403 as const, message: "No tienes permiso para realizar esta accion." };
  }
  return { ok: true as const, admin };
}
