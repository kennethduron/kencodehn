import { NextRequest, NextResponse } from "next/server";
import {
  isAllowedOwnerVerificationOrigin,
  isOwnerEmailOtpLengthValid,
  normalizeOwnerEmailOtp,
  OWNER_EMAIL_OTP_COOLDOWN_SECONDS,
  OWNER_EMAIL_OTP_TYPE,
  ownerEmailVerificationMessage,
  type OwnerEmailVerificationAction,
} from "@/lib/auth/owner-email-verification";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/service";
import { ownerEmailVerificationTemplate } from "@/lib/auth/owner-email-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = { "Cache-Control": "no-store, max-age=0" };

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: responseHeaders });
}

async function activeOwner() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("profiles").select("id,email,role,active").eq("role", "owner").eq("active", true).limit(2);
  if (error || data?.length !== 1 || !data[0]?.email) throw new Error("Owner verification is not available.");
  return data[0] as { id: string; email: string; role: "owner"; active: true };
}

export async function POST(request: NextRequest) {
  if (process.env.OWNER_EMAIL_VERIFICATION_ENABLED !== "true") return json({ ok: false }, 404);
  if (!isAllowedOwnerVerificationOrigin(request.headers.get("origin"), process.env.VERCEL_ENV === "production")) {
    return json({ ok: false, message: "Solicitud no permitida." }, 403);
  }

  let payload: { action?: OwnerEmailVerificationAction; code?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "Solicitud inválida." }, 400);
  }

  let owner: Awaited<ReturnType<typeof activeOwner>>;
  try {
    owner = await activeOwner();
  } catch {
    return json({ ok: false, message: "La verificación no está disponible temporalmente." }, 503);
  }

  if (payload.action === "request") {
    const admin = createSupabaseAdminClient();
    const current = await admin.auth.admin.getUserById(owner.id);
    const sentAt = current.data.user?.recovery_sent_at ? Date.parse(current.data.user.recovery_sent_at) : 0;
    if (Number.isFinite(sentAt) && Date.now() - sentAt < OWNER_EMAIL_OTP_COOLDOWN_SECONDS * 1000) {
      return json({ ok: false, message: ownerEmailVerificationMessage("rate_limit", 429) }, 429);
    }
    const generated = await admin.auth.admin.generateLink({ type: "magiclink", email: owner.email });
    const officialOtp = generated.data.properties?.email_otp;
    if (generated.error || !officialOtp) return json({ ok: false, message: "No pudimos generar el código de forma segura." }, 503);
    const template = ownerEmailVerificationTemplate(officialOtp);
    const delivery = await sendEmail({
      ...template,
      type: "owner_email_verification",
      to: owner.email,
      relatedUserUid: owner.id,
      idempotencyKey: `owner-email-verification:${owner.id}:${Math.floor(Date.now() / (OWNER_EMAIL_OTP_COOLDOWN_SECONDS * 1000))}`,
    });
    if (!delivery.sent) return json({ ok: false, message: "No pudimos enviar el código. Intente nuevamente más tarde." }, 503);
    return json({ ok: true, cooldownSeconds: OWNER_EMAIL_OTP_COOLDOWN_SECONDS });
  }

  if (payload.action !== "verify") return json({ ok: false, message: "Solicitud inválida." }, 400);
  const code = normalizeOwnerEmailOtp(payload.code);
  if (!isOwnerEmailOtpLengthValid(code)) return json({ ok: false, message: "Ingrese el código completo." }, 400);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ email: owner.email, token: code, type: OWNER_EMAIL_OTP_TYPE });
  if (error || data.user?.id !== owner.id) {
    if (data.session) await supabase.auth.signOut({ scope: "local" });
    return json({ ok: false, message: ownerEmailVerificationMessage(error?.code, error?.status) }, 400);
  }

  const admin = createSupabaseAdminClient();
  const { data: preserved, error: profileError } = await admin.from("profiles").select("role,active").eq("id", owner.id).maybeSingle();
  if (profileError || preserved?.role !== "owner" || preserved.active !== true) {
    await supabase.auth.signOut({ scope: "local" });
    return json({ ok: false, message: "El perfil del Owner no superó la validación de seguridad." }, 409);
  }
  return json({ ok: true, verified: true });
}
