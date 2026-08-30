import {Resend} from "resend";

const key=process.env.RESEND_API_KEY;
if(!key)throw new Error("RESEND_API_KEY is unavailable");
const resend=new Resend(key);
const [domainsResult,webhooksResult]=await Promise.all([resend.domains.list(),resend.webhooks.list()]);
if(domainsResult.error)throw new Error(`Domain audit failed: ${domainsResult.error.message}`);
if(webhooksResult.error)throw new Error(`Webhook audit failed: ${webhooksResult.error.message}`);
const domains=(domainsResult.data?.data??[]).filter(domain=>domain.name.endsWith("kencodehn.com")).map(domain=>({
 id:domain.id,
 name:domain.name,
 status:domain.status,
 region:domain.region,
 capabilities:domain.capabilities,
}));
const webhooks=(webhooksResult.data?.data??[]).map(webhook=>({
 id:webhook.id,
 endpoint:webhook.endpoint,
 events:webhook.events,
 status:webhook.status,
}));
console.log(JSON.stringify({domains,webhooks},null,2));
