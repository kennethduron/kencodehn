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
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(notification.title || "Ken Code CRM", {
    body: notification.body || "Nueva actividad en el CRM.",
    icon: "/images/fav-icon.jpg",
    badge: "/images/fav-icon.jpg",
    data: { url: data.actionUrl || "/admin" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const candidate = String(event.notification.data?.url || "/admin");
  const url = /^\/admin(?:[/?#]|$)/.test(candidate) ? candidate : "/admin";
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(url);
      return existing.focus();
    }
    return clients.openWindow(url);
  })());
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
