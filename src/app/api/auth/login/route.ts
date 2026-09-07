import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { USERNAME_LOGIN_ERROR, canonicalUsername, validateUsername } from "@/lib/auth/username";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";

export const runtime = "nodejs";
const loginSchema = z.object({ identifier: z.string().trim().min(3).max(254), password: z.string().min(1).max(4096) }).strict();

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

function attemptHash(value: string) {
  return createHash("sha256").update(`${process.env.SUPABASE_SECRET_KEY || "local"}:${value}`).digest("hex");
}

async function minimumDelay(startedAt: number) {
  const remaining = 450 - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    await minimumDelay(startedAt);
    return json({ ok: false, message: USERNAME_LOGIN_ERROR }, 401);
  }

  const client = createSupabaseAdminClient();
  const identifier = parsed.data.identifier;
  const normalizedIdentifier = identifier.includes("@") ? identifier.toLowerCase() : canonicalUsername(identifier);
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const device = request.headers.get("user-agent") || "unknown";
  const attemptKeys = [
    attemptHash(`ip:${forwarded}`),
    attemptHash(`identifier:${normalizedIdentifier}`),
    attemptHash(`device:${device}`),
  ];
  const windowStart = new Date(Date.now() - 15 * 60_000).toISOString();
  const attempts = await client.from("auth_login_attempts").select("attempt_key").in("attempt_key", attemptKeys).gte("created_at", windowStart).limit(60);
  const perKey = new Map<string, number>();
  for (const row of attempts.data || []) perKey.set(row.attempt_key, (perKey.get(row.attempt_key) || 0) + 1);
  if (attemptKeys.some((key) => (perKey.get(key) || 0) >= 10)) {
    await minimumDelay(startedAt);
    return json({ ok: false, message: USERNAME_LOGIN_ERROR }, 429);
  }

  let email = identifier.trim().toLowerCase();
  if (!identifier.includes("@")) {
    const valid = validateUsername(identifier);
    const resolved = valid.ok
      ? await client.from("profiles").select("email").eq("username_canonical", valid.canonical).eq("active", true).maybeSingle()
      : { data: null };
    email = String(resolved.data?.email || `unavailable-${attemptKeys[1].slice(0, 20)}@invalid.kencodehn.com`);
  }

  const { url, publishableKey } = getPublicSupabaseConfig();
  let authResult: Record<string, any> = {};
  try {
    const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: parsed.data.password }),
      cache: "no-store",
    });
    authResult = await authResponse.json().catch(() => ({}));
  } catch {
    authResult = {};
  }

  const userId = typeof authResult.user?.id === "string" ? authResult.user.id : "";
  const profile = userId ? await client.from("profiles").select("id,active").eq("id", userId).maybeSingle() : { data: null };
  const success = Boolean(profile.data?.active === true && authResult.access_token && authResult.refresh_token);
  await Promise.all([
    client.from("auth_login_attempts").insert(attemptKeys.map((attemptKey) => ({ attempt_key: attemptKey, successful: success }))),
    client.from("auth_login_attempts").delete().lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()),
  ]);
  await minimumDelay(startedAt);
  if (!success) return json({ ok: false, message: USERNAME_LOGIN_ERROR }, 401);
  return json({ ok: true, accessToken: authResult.access_token, refreshToken: authResult.refresh_token, expiresIn: authResult.expires_in });
}
