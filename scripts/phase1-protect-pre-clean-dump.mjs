import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

const projectRef = "nvtrgrltyzrkljarvwff";
const dumpPath = process.argv[2];
const artifactRoot = process.argv[3] ?? join("migration-artifacts", "pre-clean-baseline");

if (!dumpPath || !existsSync(dumpPath)) throw new Error("A Supabase CLI data dump is required.");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function dpapi(mode, value) {
  const helper = join(process.cwd(), "scripts", "dpapi-key.ps1");
  const commandMode = mode === "protect" ? "Protect" : "Unprotect";
  return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", helper, "-Mode", commandMode, "-Value", value], { encoding: "utf8" }).trim();
}

function copyCounts(sql) {
  const result = {};
  const lines = sql.split(/\r?\n/);
  let table = null;
  let count = 0;
  for (const line of lines) {
    const start = line.match(/^COPY (?:public\.|"public"\.")([a-z0-9_]+)"?\s/i);
    if (start) {
      table = start[1];
      count = 0;
      continue;
    }
    if (table && line === "\\.") {
      result[table] = count;
      table = null;
      continue;
    }
    if (table) count += 1;
  }
  return result;
}

const sql = readFileSync(dumpPath);
const sqlText = sql.toString("utf8");
for (const forbidden of [
  "COPY auth.",
  "COPY public.device_tokens",
  "COPY public.migration_id_map",
  "COPY public.migration_checkpoints",
  'COPY "auth".',
  'COPY "public"."device_tokens"',
  'COPY "public"."migration_id_map"',
  'COPY "public"."migration_checkpoints"',
]) {
  if (sqlText.includes(forbidden)) throw new Error(`Unsafe backup input contains excluded relation marker: ${forbidden}`);
}
const counts = copyCounts(sqlText);
const expectedTables = ["profiles", "leads", "lead_notes", "tasks", "reminder_events", "notifications", "activity_logs", "email_logs", "push_logs", "admin_settings"];
for (const table of expectedTables) {
  if (!(table in counts)) throw new Error(`Backup input is missing expected public table: ${table}`);
}

const capturedAt = new Date().toISOString();
const compressed = gzipSync(sql, { level: 9 });
const key = randomBytes(32);
const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
const tag = cipher.getAuthTag();
const envelope = Buffer.concat([Buffer.from("KCPB1"), iv, tag, encrypted]);
const protectedKey = dpapi("protect", key.toString("base64"));
const recoveredKey = Buffer.from(dpapi("unprotect", protectedKey), "base64");
if (!key.equals(recoveredKey)) throw new Error("DPAPI recovery verification failed.");

const decipher = createDecipheriv("aes-256-gcm", recoveredKey, iv);
decipher.setAuthTag(tag);
const verifiedSql = gunzipSync(Buffer.concat([decipher.update(encrypted), decipher.final()]));
if (!verifiedSql.equals(sql)) throw new Error("Encrypted backup round-trip verification failed.");

const stamp = capturedAt.replace(/[:.]/g, "-");
const outputDir = join(artifactRoot, stamp);
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, "PRE_CLEAN_BASELINE.kcbackup"), envelope);
writeFileSync(join(outputDir, "PRE_CLEAN_BASELINE.key.dpapi"), `${protectedKey}\n`, { mode: 0o600 });
const manifest = {
  format: "KEN_CODE_PRE_CLEAN_BASELINE_V1",
  source: { provider: "supabase", project_ref: projectRef },
  captured_at: capturedAt,
  protection: "AES-256-GCM; random key protected with Windows DPAPI CurrentUser",
  payload_sha256: sha256(envelope),
  plaintext_sha256: sha256(sql),
  payload_bytes: envelope.length,
  counts,
  excluded: {
    auth_schema: "Excluded: no passwords, Auth hashes or Auth secrets.",
    device_tokens: "Excluded: browser/device credential material.",
    migration_history: "Excluded from commercial payload and preserved remotely.",
  },
  verification: "PASS",
};
writeFileSync(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  status: "PASS",
  artifact_directory: outputDir,
  source_project_ref: projectRef,
  captured_at: capturedAt,
  protection: manifest.protection,
  payload_sha256: manifest.payload_sha256,
  counts,
  verification: manifest.verification,
}, null, 2));
