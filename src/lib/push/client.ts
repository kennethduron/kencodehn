import { getFirebaseClient } from "@/lib/firebase/client";

export async function getCurrentPushToken() {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) return null;
  if (Notification.permission !== "granted") return null;
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return null;
  const firebase = getFirebaseClient();
  if (!firebase.ok) return null;
  const messaging = await import("firebase/messaging");
  if (!(await messaging.isSupported())) return null;
  return messaging.getToken(messaging.getMessaging(firebase.app), {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
}

export async function unregisterCurrentPushDevice() {
  const token = await getCurrentPushToken();
  if (!token) return;
  await fetch("/api/admin/push/devices", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
}
