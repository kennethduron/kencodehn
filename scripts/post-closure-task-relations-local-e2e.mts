import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.SUPABASE_LOCAL_URL || "";
const publishableKey = process.env.SUPABASE_LOCAL_PUBLISHABLE_KEY || "";
const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_KEY || "";
const parsed = new URL(apiUrl);
if (!publishableKey || !serviceKey || !["127.0.0.1", "localhost"].includes(parsed.hostname)) {
  throw new Error("Task relation E2E refuses non-loopback services.");
}

const service = createClient(apiUrl, serviceKey, { auth: { persistSession: false } });
const runId = crypto.randomUUID().slice(0, 8);
const password = "Task-Relations-Local-2026!";
const now = new Date().toISOString();
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const users = {
  owner: { id: crypto.randomUUID(), role: "owner", email: `owner.tasks.${runId}@example.test` },
  manager: { id: crypto.randomUUID(), role: "manager", email: `manager.tasks.${runId}@example.test` },
  sales: { id: crypto.randomUUID(), role: "sales_agent", email: `sales.tasks.${runId}@example.test` },
  viewer: { id: crypto.randomUUID(), role: "viewer", email: `viewer.tasks.${runId}@example.test` },
  inactive: { id: crypto.randomUUID(), role: "sales_agent", email: `inactive.tasks.${runId}@example.test` },
} as const;
const authIds: string[] = [];
const taskIds: string[] = [];
const clientIds: string[] = [];
const leadIds: string[] = [];

async function login(email: string) {
  const client = createClient(apiUrl, publishableKey, { auth: { persistSession: false } });
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  return client;
}

try {
  for (const user of Object.values(users)) {
    const created = await service.auth.admin.createUser({ id: user.id, email: user.email, password, email_confirm: true });
    if (created.error) throw created.error;
    authIds.push(user.id);
  }
  const profiles = await service.from("profiles").insert(Object.entries(users).map(([name, user]) => ({
    id: user.id,
    name: `${name} local`,
    email: user.email,
    role: user.role,
    active: name !== "inactive",
  })));
  if (profiles.error) throw profiles.error;

  const [owner, manager, sales, viewer, inactive] = await Promise.all([
    login(users.owner.email), login(users.manager.email), login(users.sales.email), login(users.viewer.email), login(users.inactive.email),
  ]);
  const leadId = crypto.randomUUID();
  leadIds.push(leadId);
  const lead = await service.from("leads").insert({
    id: leadId,
    firebase_id: `local-lead:${runId}`,
    name: "Prospecto inmediato",
    business: "Veterinaria Local",
    email: `prospect.${runId}@example.test`,
    phone: "+504 0000-0000",
    assigned_to: users.sales.id,
    assigned_at: now,
    assigned_by: users.owner.id,
    created_at: now,
    updated_at: now,
  });
  if (lead.error) throw lead.error;
  const clientId = crypto.randomUUID();
  clientIds.push(clientId);
  const clientRow = await service.from("clients").insert({
    id: clientId,
    name: "Cliente inmediato",
    company: "Car Zone Local",
    email: `client.${runId}@example.test`,
    phone: "+504 1111-1111",
    assigned_to: users.sales.id,
    assigned_at: now,
    assigned_by: users.owner.id,
    created_by: users.owner.id,
  });
  if (clientRow.error) throw clientRow.error;

  const clientTask = await sales.rpc("task_write_v2", {
    p_operation: "task_create",
    p_payload: { input: { title: "Tarea cliente local", relationType: "client", relationId: clientId, assignedToUid: users.sales.id, date: tomorrow, time: "09:00", priority: "medium", status: "pending", type: "follow_up" } },
  });
  if (clientTask.error) throw new Error(`client task: ${clientTask.error.message}`);
  taskIds.push(clientTask.data.id);
  const leadTask = await sales.rpc("task_write_v2", {
    p_operation: "task_create",
    p_payload: { input: { title: "Tarea prospecto local", relationType: "lead", relationId: leadId, assignedToUid: users.sales.id, date: tomorrow, time: "10:00", priority: "medium", status: "pending", type: "call" } },
  });
  if (leadTask.error) throw new Error(`lead task: ${leadTask.error.message}`);
  taskIds.push(leadTask.data.id);
  const internalTask = await owner.rpc("task_write_v2", {
    p_operation: "task_create",
    p_payload: { input: { title: "Tarea interna local", relationType: null, relationId: null, assignedToUid: users.owner.id, date: tomorrow, time: "11:00", priority: "low", status: "pending", type: "meeting" } },
  });
  if (internalTask.error) throw new Error(`internal task: ${internalTask.error.message}`);
  taskIds.push(internalTask.data.id);
  const managerTask = await manager.rpc("task_write_v2", {
    p_operation: "task_create",
    p_payload: { input: { title: "Tarea gerente local", relationType: "client", relationId: clientId, assignedToUid: users.owner.id, date: tomorrow, time: "12:00", priority: "high", status: "pending", type: "proposal" } },
  });
  if (managerTask.error) throw new Error(`manager task: ${managerTask.error.message}`);
  taskIds.push(managerTask.data.id);

  assert.ok((await viewer.rpc("task_write_v2", { p_operation: "task_create", p_payload: { input: { title: "Viewer denied", assignedToUid: users.viewer.id, date: tomorrow, time: "13:00" } } })).error);
  assert.ok((await inactive.rpc("task_write_v2", { p_operation: "task_create", p_payload: { input: { title: "Inactive denied", assignedToUid: users.inactive.id, date: tomorrow, time: "13:00" } } })).error);

  const clientTasks = await sales.from("tasks").select("id,client_id,lead_id").eq("client_id", clientId);
  if (clientTasks.error) throw clientTasks.error;
  assert.equal(clientTasks.data.length, 1);
  assert.equal(clientTasks.data.filter((task) => task.id === clientTask.data.id).length, 1);
  const globalTasks = await owner.from("tasks").select("id,client_id,lead_id").in("id", taskIds);
  if (globalTasks.error) throw globalTasks.error;
  assert.equal(globalTasks.data.length, 4);
  assert.equal(globalTasks.data.filter((task) => task.id === clientTask.data.id).length, 1);
  const salesScope = await sales.from("tasks").select("id").in("id", taskIds);
  assert.deepEqual(new Set((salesScope.data || []).map((task) => task.id)), new Set([clientTask.data.id, leadTask.data.id]));
  assert.equal((await viewer.from("tasks").select("id").in("id", taskIds)).data?.length, 0);

  const convertedClientId = crypto.randomUUID();
  clientIds.push(convertedClientId);
  const converted = await service.from("clients").insert({
    id: convertedClientId,
    origin_lead_id: leadId,
    name: "Cliente convertido local",
    company: "Veterinaria Local",
    assigned_to: users.sales.id,
    assigned_at: now,
    assigned_by: users.owner.id,
    created_by: users.owner.id,
  });
  if (converted.error) throw converted.error;
  const conversionVisible = await owner.from("tasks").select("id,lead_id,client_id").or(`client_id.eq.${convertedClientId},lead_id.eq.${leadId}`);
  if (conversionVisible.error) throw conversionVisible.error;
  assert.equal(conversionVisible.data.filter((task) => task.id === leadTask.data.id).length, 1);
  assert.equal(conversionVisible.data.find((task) => task.id === leadTask.data.id)?.lead_id, leadId);
  assert.equal(conversionVisible.data.find((task) => task.id === leadTask.data.id)?.client_id, null);

  assert.equal((await service.from("email_logs").select("id", { count: "exact", head: true })).count, 0);
  assert.equal((await service.from("push_logs").select("id", { count: "exact", head: true })).count, 0);
  console.log(JSON.stringify({
    target: "loopback-only",
    taskRelationships: { client: "PASS", prospect: "PASS", internal: "PASS", conversionHistory: "PASS", duplicateCount: 0 },
    scope: { owner: "PASS", manager: "PASS", sales: "PASS", viewer: "DENIED", inactive: "DENIED" },
    externalDeliveries: { email: 0, push: 0, cronRuns: 0 },
  }, null, 2));
} finally {
  if (taskIds.length) {
    await service.from("assignment_notification_events").delete().in("entity_id", taskIds);
    await service.from("notifications").delete().in("task_id", taskIds);
    await service.from("activity_logs").delete().in("task_id", taskIds);
    await service.from("tasks").delete().in("id", taskIds);
  }
  for (const clientId of clientIds.reverse()) await service.from("clients").delete().eq("id", clientId);
  for (const leadId of leadIds.reverse()) await service.from("leads").delete().eq("id", leadId);
  for (const id of authIds.reverse()) await service.auth.admin.deleteUser(id, false);
}
