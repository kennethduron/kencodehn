import assert from "node:assert/strict";
import { createClient, type GenerateLinkType } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { buildCrmInvitationHandoffLink } from "../src/lib/admin/invitation.ts";

const apiUrl = process.env.SUPABASE_LOCAL_URL || "";
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY || "";
const appUrl = process.env.KEN_CODE_LOCAL_APP_URL || "";
const apiHost = new URL(apiUrl).hostname;
const appHost = new URL(appUrl).hostname;
if (!serviceKey || !["127.0.0.1", "localhost"].includes(apiHost) || !["127.0.0.1", "localhost"].includes(appHost)) {
  throw new Error("Invitation route E2E refuses non-loopback services.");
}

const service = createClient(apiUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const createdIds: string[] = [];

async function verifyInvitationHandoff(type: Extract<GenerateLinkType, "invite" | "magiclink">, email: string) {
  const generated = await service.auth.admin.generateLink({
    type,
    email,
    options: { redirectTo: `${appUrl}/admin/recovery?mode=invite` },
  });
  const user = generated.data.user;
  const tokenHash = generated.data.properties?.hashed_token;
  if (generated.error || !user || !tokenHash) throw generated.error ?? new Error("Official invitation credential was not generated.");
  if (!createdIds.includes(user.id)) createdIds.push(user.id);

  const productionLink = new URL(buildCrmInvitationHandoffLink(tokenHash, type));
  const handoff = new URL(`${productionLink.pathname}${productionLink.search}${productionLink.hash}`, appUrl);
  const browser = await chromium.launch({ headless: true });
  try {
    const acceptedContext = await browser.newContext();
    const acceptedPage = await acceptedContext.newPage();
    await acceptedPage.goto(handoff.toString());
    await acceptedPage.waitForFunction(() => {
      const button = Array.from(document.querySelectorAll("button")).find((candidate) => candidate.textContent?.trim() === "Configurar cuenta") as HTMLButtonElement | undefined;
      return window.location.hash === "" && Boolean(button) && !button?.disabled;
    });
    const acceptedUrl = new URL(acceptedPage.url());
    assert.equal(acceptedUrl.pathname, "/admin/recovery");
    assert.equal(acceptedUrl.searchParams.get("mode"), "invite");
    assert.equal(acceptedUrl.searchParams.has("token_hash"), false);
    assert.equal(acceptedUrl.searchParams.has("code"), false);
    assert.equal(acceptedUrl.hash, "");
    assert.equal(await acceptedPage.getByRole("button", { name: "Configurar cuenta" }).isEnabled(), true);
    await acceptedContext.close();

    const reusedContext = await browser.newContext();
    const reusedPage = await reusedContext.newPage();
    await reusedPage.goto(handoff.toString());
    await reusedPage.waitForFunction(() => window.location.hash === "" && document.querySelector("[role='status']")?.textContent?.includes("inválido"));
    assert.match(await reusedPage.getByRole("status").innerText(), /inválido, expiró o ya fue utilizado/);
    assert.equal(new URL(reusedPage.url()).hash, "");
    await reusedContext.close();
  } finally {
    await browser.close();
  }
}

try {
  const suffix = crypto.randomUUID().slice(0, 8);
  await verifyInvitationHandoff("invite", `route.invite.${suffix}@example.test`);

  const confirmedEmail = `route.magic.${suffix}@example.test`;
  const confirmed = await service.auth.admin.createUser({
    email: confirmedEmail,
    password: "Local-Invitation-Route-2026!",
    email_confirm: true,
  });
  if (confirmed.error || !confirmed.data.user) throw confirmed.error ?? new Error("Confirmed fixture was not created.");
  createdIds.push(confirmed.data.user.id);
  await verifyInvitationHandoff("magiclink", confirmedEmail);

  console.log("Invitation fragment handoff, clean URL and one-time behavior local E2E: PASS");
} finally {
  for (const id of createdIds.reverse()) await service.auth.admin.deleteUser(id);
}
