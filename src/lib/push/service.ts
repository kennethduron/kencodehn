import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { getAdminDb, getAdminMessaging, getAdminServerTimestamp } from "@/lib/firebase/admin";
import { getAdminSettings } from "@/lib/admin/settings";
import { isSupabaseDataProviderEnabled } from "@/lib/data/provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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

export function safePushActionUrl(value?: string | null) {
  const candidate = String(value || "").trim();
  return /^\/admin(?:[/?#]|$)/.test(candidate) ? candidate : "/admin";
}

export async function registerDeviceToken(input: {
  uid: string;
  email: string;
  token: string;
  userAgent?: string;
  platform?: string;
}) {
  if (isSupabaseDataProviderEnabled()) {
    const client = createSupabaseAdminClient();
    const tokenHash = createHash("sha256").update(input.token).digest("hex");
    const { data: existing, error: findError } = await client.from("device_tokens").select("id,created_at").eq("token_hash", tokenHash).maybeSingle();
    if (findError) throw new Error(`Supabase device lookup failed (${findError.code ?? "unknown"}).`);
    const id = existing?.id ?? randomUUID();
    const now = new Date().toISOString();
    const { error } = await client.from("device_tokens").upsert({
      id, firebase_id: `supabase:${id}`, profile_id: input.uid, token: input.token, token_hash: tokenHash,
      user_agent: input.userAgent ?? "", platform: input.platform ?? "", active: true, disabled_by: null, disabled_at: null,
      created_at: existing?.created_at ?? now, updated_at: now,
    }, { onConflict: "token_hash" });
    if (error) throw new Error(`Supabase device registration failed (${error.code ?? "unknown"}).`);
    return id;
  }
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
  if (isSupabaseDataProviderEnabled()) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { error } = await createSupabaseAdminClient().from("device_tokens").update({ active: false, disabled_by: actor.uid, disabled_at: new Date().toISOString() }).eq("token_hash", tokenHash).eq("profile_id", actor.uid);
    if (error) throw new Error(`Supabase device deactivation failed (${error.code ?? "unknown"}).`);
    return;
  }
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
  if (isSupabaseDataProviderEnabled()) {
    const client = createSupabaseAdminClient();
    let profileId: string | null = null;
    if (email) {
      const { data: profile, error: profileError } = await client.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
      if (profileError) throw new Error(`Supabase device profile lookup failed (${profileError.code ?? "unknown"}).`);
      if (!profile) return [];
      profileId = profile.id;
    }
    let query = client.from("device_tokens").select("*,profiles!device_tokens_profile_id_fkey(email,active)").limit(email ? 50 : 200);
    query = profileId ? query.eq("profile_id", profileId) : query.eq("active", true);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase device query failed (${error.code ?? "unknown"}).`);
    return (data ?? []).filter((row: any) => row.profiles?.active === true).map((row: any) => ({
      id: String(row.id), uid: String(row.profile_id), email: String(row.profiles?.email ?? email ?? ""), token: String(row.token ?? ""),
      userAgent: String(row.user_agent ?? ""), platform: String(row.platform ?? ""), active: row.active === true,
      createdAt: String(row.created_at ?? ""), updatedAt: String(row.updated_at ?? ""),
    }));
  }
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
  if (isSupabaseDataProviderEnabled()) {
    const client = createSupabaseAdminClient();
    let existingId: string | null = null;
    if (input.idempotencyKey && tokenId) {
      const { data, error } = await client.from("push_logs").select("id").eq("idempotency_key", input.idempotencyKey).eq("device_token_id", tokenId).maybeSingle();
      if (error) throw new Error(`Supabase push log lookup failed (${error.code ?? "unknown"}).`);
      existingId = data?.id ?? null;
    }
    const id = existingId ?? randomUUID();
    const { error } = await client.from("push_logs").upsert({
      id, firebase_id: `supabase:${id}`, device_token_id: tokenId, type: input.type, title: input.title, message: input.message,
      sent, reason, lead_id: input.relatedLeadId ?? null, task_id: input.relatedTaskId ?? null,
      idempotency_key: input.idempotencyKey ?? null, created_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Supabase push log failed (${error.code ?? "unknown"}).`);
    return true;
  }
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
  const actionUrl = safePushActionUrl(parsed.data.actionUrl);
  if (activeDevices.length === 0) {
    await logPush(parsed.data, null, false, "no_active_devices");
    return { sent: 0, failed: 0, reason: "no_active_devices" };
  }
  if (parsed.data.idempotencyKey) {
    if (isSupabaseDataProviderEnabled()) {
      const client = createSupabaseAdminClient();
      const { data, error } = await client.from("push_logs").select("device_token_id").eq("idempotency_key", parsed.data.idempotencyKey).eq("sent", true);
      if (error) throw new Error(`Supabase push idempotency lookup failed (${error.code ?? "unknown"}).`);
      const delivered = new Set((data ?? []).map((row) => row.device_token_id));
      activeDevices = activeDevices.filter((device) => !delivered.has(device.id));
    } else {
      const db = getAdminDb();
      const priorDeliveries = await Promise.all(activeDevices.map((device) => db?.collection("pushLogs").doc(pushDeliveryId(parsed.data.idempotencyKey as string, device.id)).get()));
      activeDevices = activeDevices.filter((_, index) => priorDeliveries[index]?.data()?.sent !== true);
    }
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
              link: actionUrl,
            },
          },
          data: {
            type: parsed.data.type,
            actionUrl,
            leadId: parsed.data.relatedLeadId || "",
            taskId: parsed.data.relatedTaskId || "",
          },
        });
        sent += 1;
        await logPush(parsed.data, device.id, true, null);
      } catch (error) {
        failed += 1;
        await logPush(parsed.data, device.id, false, "push_send_failed");
        if (String(error).includes("registration-token-not-registered")) {
          if (isSupabaseDataProviderEnabled()) {
            await createSupabaseAdminClient().from("device_tokens").update({ active: false, disabled_at: new Date().toISOString() }).eq("id", device.id);
          } else {
            const db = getAdminDb();
            await db?.collection("deviceTokens").doc(device.id).set({ active: false, updatedAt: getAdminServerTimestamp() }, { merge: true });
          }
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
  if (isSupabaseDataProviderEnabled()) {
    const { data, error } = await createSupabaseAdminClient().from("device_tokens").select("*,profiles!device_tokens_profile_id_fkey(email,active)").eq("profile_id", uid).eq("active", true).limit(50);
    if (error) throw new Error(`Supabase user device query failed (${error.code ?? "unknown"}).`);
    const devices = (data ?? []).filter((row: any) => row.profiles?.active === true).map((row: any) => ({
      id: String(row.id), uid: String(row.profile_id), email: String(row.profiles?.email ?? ""), token: String(row.token ?? ""),
      userAgent: String(row.user_agent ?? ""), platform: String(row.platform ?? ""), active: true,
      createdAt: String(row.created_at ?? ""), updatedAt: String(row.updated_at ?? ""),
    }));
    return sendPushToDevices(input, devices);
  }
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
