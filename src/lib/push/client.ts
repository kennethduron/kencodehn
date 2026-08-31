import { getFirebaseClient } from "@/lib/firebase/client";

const SERVICE_WORKER_URL = "/firebase-messaging-sw.js?v=20260902000900";

export type PushCapability =
  | { supported: true }
  | { supported: false; reason: "insecure" | "notifications" | "service_worker" | "push_manager" | "configuration" };

export function getPushCapability(): PushCapability {
  if (typeof window === "undefined") return { supported: false, reason: "notifications" };
  if (!window.isSecureContext) return { supported: false, reason: "insecure" };
  if (!("Notification" in window)) return { supported: false, reason: "notifications" };
  if (!("serviceWorker" in navigator)) return { supported: false, reason: "service_worker" };
  if (!("PushManager" in window)) return { supported: false, reason: "push_manager" };
  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || !process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) {
    return { supported: false, reason: "configuration" };
  }
  return { supported: true };
}

async function getMessagingContext() {
  const capability = getPushCapability();
  if (!capability.supported) return null;
  const firebase = getFirebaseClient();
  if (!firebase.ok) return null;
  const messagingSdk = await import("firebase/messaging");
  if (!(await messagingSdk.isSupported())) return null;
  return { firebase, messagingSdk, vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY as string };
}

export async function ensurePushServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
    scope: "/",
    updateViaCache: "none",
  });
  await registration.update().catch(() => undefined);
  if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return registration;
}

export async function createCurrentPushToken() {
  const context = await getMessagingContext();
  if (!context) return null;
  const registration = await ensurePushServiceWorker();
  if (!registration) return null;
  return context.messagingSdk.getToken(context.messagingSdk.getMessaging(context.firebase.app), {
    vapidKey: context.vapidKey,
    serviceWorkerRegistration: registration,
  });
}

export async function getCurrentPushToken() {
  if (typeof window === "undefined" || !getPushCapability().supported) return null;
  if (Notification.permission !== "granted") return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return null;
  const context = await getMessagingContext();
  if (!context) return null;
  return context.messagingSdk.getToken(context.messagingSdk.getMessaging(context.firebase.app), {
    vapidKey: context.vapidKey,
    serviceWorkerRegistration: registration,
  });
}

export async function deleteCurrentPushToken() {
  const context = await getMessagingContext();
  if (!context) return false;
  return context.messagingSdk.deleteToken(context.messagingSdk.getMessaging(context.firebase.app));
}

export async function subscribeToForegroundPush(onMessage: (payload: { data?: Record<string, string> }) => void) {
  const context = await getMessagingContext();
  if (!context) return () => undefined;
  return context.messagingSdk.onMessage(context.messagingSdk.getMessaging(context.firebase.app), (payload) => {
    onMessage({ data: payload.data });
  });
}

export async function unregisterCurrentPushDevice() {
  const token = await getCurrentPushToken();
  if (!token) return;
  const response = await fetch("/api/admin/push/devices", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (response.ok) await deleteCurrentPushToken().catch(() => false);
}
