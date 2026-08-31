import { readFileSync } from "node:fs";

const input = process.argv[2];
if (!input) throw new Error("Usage: phase6-audit-dump <official-data-dump.sql>");

const wanted = new Set([
  "billing_job_runs",
  "billing_scheduler_state",
  "mail_threads",
  "mail_messages",
  "mail_audit_events",
  "mail_webhook_events",
  "notifications",
]);

const tables = new Map();
let active = null;
for (const line of readFileSync(input, "utf8").split(/\r?\n/)) {
  const header = line.match(/^COPY "public"\."([a-z0-9_]+)" \((.+)\) FROM stdin;$/);
  if (header) {
    const table = header[1];
    active = wanted.has(table)
      ? { table, columns: [...header[2].matchAll(/"([a-z0-9_]+)"/g)].map((match) => match[1]), rows: [] }
      : null;
    if (active) tables.set(table, active);
    continue;
  }
  if (line === "\\.") { active = null; continue; }
  if (active) {
    const values = line.split("\t").map((value) => value === "\\N" ? null : value);
    active.rows.push(Object.fromEntries(active.columns.map((column, index) => [column, values[index] ?? null])));
  }
}

for (const table of wanted) if (!tables.has(table)) throw new Error(`Audit dump is missing ${table}.`);
const rows = (table) => tables.get(table).rows;
const group = (items, key) => Object.fromEntries([...new Set(items.map((item) => String(item[key])))].sort().map((value) => [value, items.filter((item) => String(item[key]) === value).length]));
const duplicates = (items, key) => {
  const counts = new Map();
  for (const item of items) if (item[key]) counts.set(item[key], (counts.get(item[key]) || 0) + 1);
  return [...counts.values()].filter((count) => count > 1).length;
};

const jobs = rows("billing_job_runs");
const scheduler = rows("billing_scheduler_state");
const threads = rows("mail_threads");
const messages = rows("mail_messages");
const webhookEvents = rows("mail_webhook_events");
const audits = rows("mail_audit_events");
const notifications = rows("notifications");
const messagesPerThread = new Map(threads.map((thread) => [thread.id, 0]));
for (const message of messages) messagesPerThread.set(message.thread_id, (messagesPerThread.get(message.thread_id) || 0) + 1);
const messagesByMessageId = new Map(messages.filter((message) => message.message_id).map((message) => [message.message_id, message]));
const storedParentLinks = messages
  .filter((message) => message.in_reply_to && messagesByMessageId.has(message.in_reply_to))
  .map((message) => ({ message, parent: messagesByMessageId.get(message.in_reply_to) }));

console.log(JSON.stringify({
  scheduler: scheduler.map(({ provider, generation_schedule, delivery_schedule }) => ({ provider, generation_schedule, delivery_schedule })),
  naturalJobs: {
    total: jobs.length,
    byType: group(jobs, "job_type"),
    bySource: group(jobs, "source"),
    byStatus: group(jobs, "status"),
    sent: jobs.reduce((sum, row) => sum + Number(row.sent || 0), 0),
    failed: jobs.reduce((sum, row) => sum + Number(row.failed || 0), 0),
  },
  mail: {
    threads: threads.length,
    threadsByState: group(threads, "state"),
    threadsWithoutMessages: [...messagesPerThread.values()].filter((count) => count === 0).length,
    messages: messages.length,
    messagesByDirection: group(messages, "direction"),
    messagesByDelivery: group(messages, "delivery_status"),
    uniqueMessageThreads: new Set(messages.map((message) => message.thread_id)).size,
    repliesWithParent: messages.filter((message) => message.in_reply_to).length,
    repliesWithReferences: messages.filter((message) => message.reference_ids && message.reference_ids !== "{}").length,
    storedParentLinks: storedParentLinks.length,
    storedParentLinksByDirection: group(storedParentLinks.map(({ message }) => message), "direction"),
    crossThreadStoredParentLinks: storedParentLinks.filter(({ message, parent }) => message.thread_id !== parent.thread_id).length,
    messagesInMultiMessageThreads: messages.filter((message) => (messagesPerThread.get(message.thread_id) || 0) > 1).length,
    threadMessageCounts: [...messagesPerThread.values()].sort((left, right) => right - left),
    duplicateProviderIds: duplicates(messages, "provider_email_id"),
    duplicateMessageIds: duplicates(messages, "message_id"),
  },
  webhooks: {
    total: webhookEvents.length,
    byType: group(webhookEvents, "event_type"),
    byStatus: group(webhookEvents, "status"),
    byErrorCategory: group(webhookEvents.filter((event) => event.error_category), "error_category"),
  },
  audits: { total: audits.length, byAction: group(audits, "action") },
  notifications: { total: notifications.length, byType: group(notifications, "type"), read: notifications.filter((notification) => notification.is_read === "t").length },
}, null, 2));
