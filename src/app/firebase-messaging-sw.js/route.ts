import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
  const body = `
const WORKER_VERSION = "20260902000900";
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = data.title || notification.title || "Ken Code CRM";
  const body = data.message || notification.body || "Nueva actividad en el CRM.";
  const actionUrl = data.actionUrl || "/admin";
  if (self.navigator && typeof self.navigator.setAppBadge === "function" && data.badgeCount) {
    self.navigator.setAppBadge(Number(data.badgeCount)).catch(() => undefined);
  }
  return self.registration.showNotification(title, {
    body,
    icon: "/images/fav-icon.jpg",
    badge: "/images/fav-icon.jpg",
    data: { url: actionUrl, workerVersion: WORKER_VERSION },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notificationData = event.notification.data || {};
  const candidate = String(notificationData.url || "/admin");
  const isAdminRoute = candidate === "/admin"
    || candidate.startsWith("/admin/")
    || candidate.startsWith("/admin?")
    || candidate.startsWith("/admin#");
  const url = isAdminRoute ? candidate : "/admin";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(url);
      return existing.focus();
    }
    return self.clients.openWindow(url);
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
`;
  return new NextResponse(body, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
      "service-worker-allowed": "/",
    },
  });
}
