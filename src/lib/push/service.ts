import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { getAdminDb, getAdminMessaging } from "@/lib/firebase/admin";
import { getAdminSettings } from "@/lib/admin/settings";

export type PushType = "lead_new" | "task_reminder" | "task_due" | "task_overdue" | "system";

export type PushPayload = {
  type: PushType;
  title: string;
  message: string;
  actionUrl?: string | null;
  relatedLeadId?: string | null;
  relatedTaskId?: string | null;
  idempotencyKey?: string | null;
};

const pushPayloadSchema = z.object({
  type: z.enum(["lead_new", "task_reminder", "task_due", "task_overdue", "system"]),
  title: z.string().trim().min(2).max(120),
  message: z.string().trim().min(2).max(500),
  actionUrl: z.string().trim().max(240).optional().nullable(),
  relatedLeadId: z.string().trim().max(160).optional().nullable(),
  relatedTaskId: z.string().trim().max(160).optional().nullable(),
  idempotencyKey: z.string().trim().max(200).optional().nullable(),
});

export async function registerDeviceToken(input: {
  uid: string;
  email: string;
  token: string;
  userAgent?: string;
  platform?: string;
}) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const now = new Date().toISOString();
  const tokenId = Buffer.from(input.token).toString("base64url").slice(0, 120);
  await db.collection("deviceTokens").doc(tokenId).set(
    {
      uid: input.uid,
      email: input.email,
      token: input.token,
      userAgent: input.userAgent ?? "",
      platform: input.platform ?? "",
      active: true,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );
  return tokenId;
}

export async function deactivateDeviceToken(token: string, actor: { uid: string; email: string }) {
  const db = getAdminDb();
  if (!db) {
    throw new Error("Firebase Admin no esta configurado.");
  }
  const tokenId = Buffer.from(token).toString("base64url").slice(0, 120);
  await db.collection("deviceTokens").doc(tokenId).set(
    {
      active: false,
      updatedAt: new Date().toISOString(),
      disabledByUid: actor.uid,
      disabledBy: actor.email,
    },
    { merge: true },
  );
}

export async function listDeviceTokens(email?: string) {
  const db = getAdminDb();
  if (!db) {
    return [];
  }
  const snapshot = email
    ? await db.collection("deviceTokens").where("email", "==", email).limit(50).get()
    : await db.collection("deviceTokens").where("active", "==", true).limit(200).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      uid: String(data.uid ?? ""),
      email: String(data.email ?? ""),
      token: String(data.token ?? ""),
      userAgent: String(data.userAgent ?? ""),
      platform: String(data.platform ?? ""),
      active: Boolean(data.active),
      createdAt: String(data.createdAt ?? ""),
      updatedAt: String(data.updatedAt ?? ""),
    };
  });
}

async function logPush(input: PushPayload, tokenId: string | null, sent: boolean, reason: string | null) {
  const db = getAdminDb();
  if (!db) {
    return false;
  }
  const payload = {
    type: input.type,
    title: input.title,
    message: input.message,
    tokenId,
    sent,
    reason,
    relatedLeadId: input.relatedLeadId ?? null,
    relatedTaskId: input.relatedTaskId ?? null,
    createdAt: new Date().toISOString(),
  };
  if (input.idempotencyKey && tokenId) {
    await db.collection("pushLogs").doc(pushDeliveryId(input.idempotencyKey, tokenId)).set(payload, { merge: true });
  } else {
    await db.collection("pushLogs").add(payload);
  }
  return true;
}

function pushDeliveryId(idempotencyKey: string, tokenId: string) {
  return `${idempotencyKey}_${tokenId}`.replace(/\//g, "_").slice(0, 500);
}

async function sendPushToDevices(input: PushPayload, devices: Awaited<ReturnType<typeof listDeviceTokens>>) {
  const parsed = pushPayloadSchema.safeParse(input);
  if (!parsed.success) {
    return { sent: 0, failed: 0, reason: "invalid_push_payload" };
  }
  const settings = await getAdminSettings();
  if (!settings.pushNotificationsEnabled) {
    await logPush(parsed.data, null, false, "push_notifications_disabled");
    return { sent: 0, failed: 0, reason: "push_notifications_disabled" };
  }
  const messaging = getAdminMessaging();
  if (!messaging) {
    await logPush(parsed.data, null, false, "firebase_messaging_not_configured");
    return { sent: 0, failed: 0, reason: "firebase_messaging_not_configured" };
  }
  let activeDevices = devices.filter((device) => device.active && device.token);
  if (activeDevices.length === 0) {
    await logPush(parsed.data, null, false, "no_active_devices");
    return { sent: 0, failed: 0, reason: "no_active_devices" };
  }
  if (parsed.data.idempotencyKey) {
    const db = getAdminDb();
    const priorDeliveries = await Promise.all(activeDevices.map((device) => db?.collection("pushLogs").doc(pushDeliveryId(parsed.data.idempotencyKey as string, device.id)).get()));
    activeDevices = activeDevices.filter((_, index) => priorDeliveries[index]?.data()?.sent !== true);
    if (activeDevices.length === 0) return { sent: 0, failed: 0, reason: "already_delivered" };
  }

  let sent = 0;
  let failed = 0;
  await Promise.all(
    activeDevices.map(async (device) => {
      try {
        await messaging.send({
          token: device.token,
          notification: {
            title: parsed.data.title,
            body: parsed.data.message,
          },
          webpush: {
            fcmOptions: {
              link: parsed.data.actionUrl || "/admin",
            },
          },
          data: {
            type: parsed.data.type,
            actionUrl: parsed.data.actionUrl || "/admin",
            leadId: parsed.data.relatedLeadId || "",
            taskId: parsed.data.relatedTaskId || "",
          },
        });
        sent += 1;
        await logPush(parsed.data, device.id, true, null);
      } catch (error) {
        failed += 1;
        await logPush(parsed.data, device.id, false, error instanceof Error ? error.message : "push_send_failed");
        if (String(error).includes("registration-token-not-registered")) {
          const db = getAdminDb();
          await db?.collection("deviceTokens").doc(device.id).set({ active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
      }
    }),
  );
  return { sent, failed };
}

export async function sendPushToAdmins(input: PushPayload) {
  return sendPushToDevices(input, await listDeviceTokens());
}

export async function sendPushToUser(uid: string, input: PushPayload) {
  const db = getAdminDb();
  if (!db) return { sent: 0, failed: 0, reason: "firebase_admin_not_configured" };
  const snapshot = await db.collection("deviceTokens").where("uid", "==", uid).where("active", "==", true).limit(50).get();
  const devices = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      uid: String(data.uid ?? ""),
      email: String(data.email ?? ""),
      token: String(data.token ?? ""),
      userAgent: String(data.userAgent ?? ""),
      platform: String(data.platform ?? ""),
      active: data.active === true,
      createdAt: String(data.createdAt ?? ""),
      updatedAt: String(data.updatedAt ?? ""),
    };
  });
  return sendPushToDevices(input, devices);
}
