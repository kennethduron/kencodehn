import { Resend } from "resend";

const key = process.env.RESEND_API_KEY || "";
if (!key) throw new Error("RESEND_API_KEY is unavailable.");
const endpoint = "https://kencodehn.com/api/webhooks/resend";
const requiredEvents = ["email.received","email.sent","email.delivered","email.delivery_delayed","email.failed","email.suppressed","email.bounced","email.complained"].sort();
const resend = new Resend(key);
const listed = await resend.webhooks.list();
if (listed.error) throw new Error("Resend webhook listing failed.");
const matches = (listed.data?.data || []).filter((item) => item.endpoint === endpoint);
if (matches.length !== 1) throw new Error(`Expected exactly one Ken Code webhook; found ${matches.length}.`);
const current = matches[0];
const before = [...current.events].sort();
const alreadyCurrent = current.status === "enabled" && JSON.stringify(before) === JSON.stringify(requiredEvents);
if (!alreadyCurrent) {
  const updated = await resend.webhooks.update(current.id, { endpoint, events: requiredEvents, status: "enabled" });
  if (updated.error) throw new Error("Resend webhook update failed.");
}
const verified = await resend.webhooks.list();
if (verified.error) throw new Error("Resend webhook verification failed.");
const afterMatches = (verified.data?.data || []).filter((item) => item.endpoint === endpoint);
if (afterMatches.length !== 1) throw new Error("Ken Code webhook verification is ambiguous.");
const after = [...afterMatches[0].events].sort();
if (afterMatches[0].status !== "enabled" || JSON.stringify(after) !== JSON.stringify(requiredEvents)) throw new Error("Ken Code webhook verification failed.");
console.log(JSON.stringify({ endpoint, before, after, status: afterMatches[0].status, changed: !alreadyCurrent },null,2));
