import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const taskMigration = read("supabase/migrations/20260908000100_task_relationships.sql");
const mailMigration = read("supabase/migrations/20260908000200_mail_safe_permanent_delete.sql");
const teamMigration = read("supabase/migrations/20260908000300_team_safe_permanent_delete.sql");
const taskRelations = read("src/app/api/admin/task-relations/route.ts");
const taskPicker = read("src/components/admin/task-relation-picker.tsx");
const taskPanel = read("src/components/admin/tasks-panel.tsx");
const clientTasks = read("src/components/admin/client-task-section.tsx");
const commercialData = read("src/lib/commercial/data.ts");
const repository = read("src/lib/data/repositories/supabase.ts");
const taskRoute = read("src/app/api/admin/tasks/route.ts");
const mailRoute = read("src/app/api/admin/mail/route.ts");
const mailService = read("src/lib/mail/service.ts");
const mailUi = read("src/components/admin/mail-workspace.tsx");
const users = read("src/lib/admin/supabase-users.ts");
const teamUi = read("src/components/admin/team-panel.tsx");
const timeHelpers = read("src/lib/time.ts");
const clientDetail = read("src/components/admin/client-detail.tsx");
const ui = read("src/components/admin/ui.tsx");

test("task write supports Client and Prospect relations", () => {
  assert.match(taskMigration, /v_relation_type not in \('lead','client'\)/);
  assert.match(taskMigration, /lead_id,client_id/);
});

test("Client detail fixes the relation independently from the responsible employee", () => {
  assert.match(clientTasks, /relationType: "client"/);
  assert.match(clientTasks, /relationId: client\.id/);
  assert.match(clientTasks, />Responsable<select/);
});

test("global Tasks uses the searchable relation picker", () => {
  assert.match(taskPanel, /<TaskRelationPicker/);
  assert.match(taskPanel, /relationType: draftRelation\?\.type/);
  assert.match(taskPanel, /relationId: draftRelation\?\.id/);
});

test("task relation results use business labels without rendering IDs", () => {
  assert.match(taskPicker, /item\.type === "client" \? "Cliente" : "Prospecto"/);
  assert.doesNotMatch(taskPicker, />\{item\.id\}</);
});

test("task relation search covers names, business, email, and phone", () => {
  assert.match(taskRelations, /name\.ilike/);
  assert.match(taskRelations, /company\.ilike/);
  assert.match(taskRelations, /business\.ilike/);
  assert.match(taskRelations, /email\.ilike/);
  assert.match(taskRelations, /phone\.ilike/);
});

test("task relation search is bounded and debounced", () => {
  assert.match(taskRelations, /const pageSize = 10/);
  assert.match(taskRelations, /\.range\(from, to\)/);
  assert.match(taskPicker, /}, 300\)/);
});

test("new Clients are discoverable without cached relation data", () => {
  assert.match(taskRelations, /Cache-Control": "private, no-store/);
  assert.match(taskPicker, /cache: "no-store"/);
});

test("internal Tasks remain supported without a relation", () => {
  assert.match(taskPicker, /onChange\(null\)/);
  assert.ok(taskMigration.includes("v_client_id:=null; v_lead_id:=null;"));
});

test("Client task reads include conversion-origin Lead history", () => {
  assert.match(commercialData, /origin_lead_id/);
  assert.match(commercialData, /client_id\.eq\.[^`]+lead_id\.eq/s);
});

test("Client and global views read one underlying task record", () => {
  assert.match(repository, /\.from\("tasks"\)/);
  assert.match(repository, /client_id\.eq\.\$\{clientId\},lead_id\.eq/);
  assert.doesNotMatch(clientTasks, /\.concat\(/);
});

test("task API enforces server-side capabilities", () => {
  assert.match(taskRoute, /requirePermissionsFromRequest\(request, "tasks:view"\)/);
  assert.match(taskRoute, /requirePermissionsFromRequest\(request, "tasks:edit"\)/);
});

test("task relation RLS covers Client ownership for Sales", () => {
  assert.match(taskMigration, /private\.client_in_current_scope\(p_client_id\)/);
  assert.match(taskMigration, /v_client\.assigned_to is distinct from v_actor\.id/);
});

test("task notifications retain contextual Client deep links", () => {
  assert.ok(taskMigration.includes("'/admin/clientes/'||v_client_id::text"));
  assert.match(taskMigration, /insert into public\.notifications/);
});

test("Mail eligibility ignores auxiliary audit and read history", () => {
  assert.doesNotMatch(mailMigration.slice(0, mailMigration.indexOf("drop function")), /mail_audit_events/);
  assert.doesNotMatch(mailMigration.slice(0, mailMigration.indexOf("drop function")), /mail_read_states/);
});

test("Mail attachments alone do not block eligibility", () => {
  assert.match(mailMigration, /return query select true,'eligible'/);
  assert.match(mailMigration, /case when v_count>0/);
});

test("Mail blocks Client, Prospect, Project, Module, and Proposal history", () => {
  for (const code of ["client", "lead", "project", "module", "proposal"])
    assert.match(mailMigration, new RegExp(`false,'${code}'`));
});

test("Mail blocks active follow-ups and active dependent Tasks", () => {
  assert.match(mailMigration, /completed_at is null/);
  assert.match(mailMigration, /legacy_data->>'threadId'.*status not in \('completed','cancelled'\)/);
});

test("Mail hard delete remains Trash-only and Owner-only", () => {
  assert.match(mailMigration, /v_thread\.state <> 'trash'/);
  assert.match(mailMigration, /active and role='owner'/);
  assert.match(mailService, /admin\.role !== "owner"/);
});

test("Mail hard delete requires a reason and returns exact blockers", () => {
  assert.match(mailRoute, /reason: z\.string\(\)\.trim\(\)\.min\(3\)\.max\(500\)/);
  assert.match(mailRoute, /MAIL_RETENTION_REQUIRED:/);
  assert.match(mailUi, /deleteReason/);
});

test("Mail deletes attachment metadata and queues Storage cleanup", () => {
  assert.match(mailMigration, /mail_storage_cleanup_queue/);
  assert.match(mailMigration, /delete from public\.mail_attachments/);
  assert.match(mailService, /storage\.from\("mail-attachments"\)\.remove/);
});

test("Mail deletion leaves a content-free tombstone", () => {
  assert.match(mailMigration, /mail_thread_permanently_deleted/);
  assert.match(mailMigration, /threadReference/);
  assert.doesNotMatch(mailMigration, /'body_html'/);
});

test("Mail hard-delete RPC is unavailable to browser roles", () => {
  assert.match(mailMigration, /revoke all on function public\.permanently_delete_mail_thread[\s\S]*authenticated/);
  assert.match(mailMigration, /grant execute on function public\.permanently_delete_mail_thread[\s\S]*service_role/);
});

test("Team eligibility does not use authentication history as a blocker", () => {
  for (const value of ["last_login_at", "last_sign_in_at", "invitation_status", "profile_photo_path"])
    assert.doesNotMatch(teamMigration.slice(0, teamMigration.indexOf("-- These rows")), new RegExp(value));
});

test("Team role, username, preference, and device state are auxiliary", () => {
  assert.doesNotMatch(teamMigration.slice(0, teamMigration.indexOf("-- These rows")), /username_history|device_tokens|user_notification_preferences/);
  assert.match(teamMigration, /delete from public\.device_tokens/);
  assert.match(teamMigration, /delete from public\.user_notification_preferences/);
});

test("unused Mail identity assignment is cleaned without blocking", () => {
  assert.doesNotMatch(teamMigration.slice(0, teamMigration.indexOf("-- These rows")), /mail_identity_assignments/);
  assert.match(teamMigration, /delete from public\.mail_identity_assignments where profile_id=old\.id/);
});

test("real Mail history blocks member deletion with a specific reason", () => {
  assert.match(teamMigration, /mail_messages where sent_by=p_target/);
  assert.match(teamMigration, /mail_sent/);
});

test("meaningful Task history blocks while a pending assignment can be cleaned", () => {
  assert.match(teamMigration, /status in \('in_progress','completed','overdue','cancelled'\)/);
  assert.match(teamMigration, /where assigned_to=old\.id and status='pending'/);
});

test("financial and commercial authorship block member deletion", () => {
  assert.match(teamMigration, /payments where recorded_by=p_target/);
  assert.match(teamMigration, /expenses where created_by=p_target/);
  assert.match(teamMigration, /clients where created_by=p_target/);
  assert.match(teamMigration, /add_on_proposals where created_by=p_target/);
});

test("member deletion remains Owner-only and self-protected", () => {
  assert.match(teamMigration, /active and role='owner'/);
  assert.match(teamMigration, /p_target=p_actor/);
  assert.match(teamUi, /immutableOwner/);
});

test("logged-in members can reach a business-history assessment", () => {
  assert.match(teamUi, /!immutableOwner && !isSelf \?/);
  assert.doesNotMatch(teamUi, /!member\.lastLoginAt \?/);
});

test("eligible member deletion revokes Auth and cleans ghost access state", () => {
  assert.match(users, /auth\.admin\.deleteUser\(uid, false\)/);
  assert.match(teamMigration, /delete from public\.mail_identity_assignments/);
  assert.match(teamMigration, /delete from public\.migration_id_map/);
});

test("username reuse follows the existing approved history policy", () => {
  assert.match(read("supabase/migrations/20260907000100_username_login_hardening.sql"), /now\(\) \+ interval '180 days'/);
  assert.match(read("supabase/migrations/20260907000100_username_login_hardening.sql"), /old\.role in \('owner','admin'\)/);
});

test("Team deletion records a minimal security audit", () => {
  assert.match(teamMigration, /create table public\.member_deletion_audit/);
  assert.match(teamMigration, /insert into public\.member_deletion_audit/);
  assert.match(users, /member_deletion_audit/);
  assert.match(users, /accessRevoked: true/);
});

test("dialog textarea receives stable initial focus and confirm cannot double-submit", () => {
  assert.match(mailUi, /data-dialog-initial-focus/);
  assert.match(ui, /querySelector<HTMLElement>\("\[data-dialog-initial-focus\]"\)/);
  assert.match(ui, /disabled=\{loading \|\| confirmDisabled\}/);
});

test("Mail and Team date labels hydrate consistently across browser engines", () => {
  assert.match(timeHelpers, /replace\(\/\[\\u00a0\\u202f\]\//);
  assert.match(teamUi, /normalizeIntlWhitespace/);
  assert.match(mailUi, /formatHondurasDateTime/);
  assert.match(clientDetail, /normalizeIntlWhitespace/);
});

test("destructive eligibility is assessed server-side without row-list N+1", () => {
  assert.match(mailRoute, /eligibility === "hard_delete"/);
  assert.match(mailService, /assess_mail_thread_permanent_deletion/);
  assert.match(users, /assess_member_permanent_deletion/);
  assert.doesNotMatch(teamUi, /members\.map[\s\S]*assess_member_permanent_deletion/);
});
