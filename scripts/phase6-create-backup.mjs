import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

const PROJECT_REF = "nvtrgrltyzrkljarvwff";
const schemaPath = process.argv[2];
const dataPath = process.argv[3];
const outputRoot = process.argv[4];
const storageManifestPath = process.argv[5];
if (!schemaPath || !dataPath || !outputRoot || !storageManifestPath) {
  throw new Error("Usage: phase6-create-backup <schema.sql> <data.sql> <output-directory> <storage-manifest.json>");
}
if (![schemaPath, dataPath, storageManifestPath].every(existsSync)) throw new Error("Dump and Storage manifest files are required.");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function dpapi(mode, value) {
  const helper = join(process.cwd(), "scripts", "dpapi-key.ps1");
  return execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", helper, "-Mode", mode],
    { encoding: "utf8", input: value },
  ).trim();
}

function copyCounts(sql) {
  const result = {};
  let table = null;
  let count = 0;
  for (const line of sql.split(/\r?\n/)) {
    const match = line.match(/^COPY\s+(?:"public"\.|public\.)(?:")?([a-z0-9_]+)(?:")?\s/i);
    if (match) {
      table = match[1];
      count = 0;
    } else if (table && line === "\\.") {
      result[table] = count;
      table = null;
    } else if (table) {
      count += 1;
    }
  }
  return result;
}

const linkedRef = readFileSync(join("supabase", ".temp", "project-ref"), "utf8").trim();
if (linkedRef !== PROJECT_REF) throw new Error("Refusing backup: linked Supabase project is not Ken Code.");

const schema = readFileSync(schemaPath);
const data = readFileSync(dataPath);
const dataText = data.toString("utf8");
for (const forbidden of [
  'COPY "auth".',
  "COPY auth.",
  'COPY "public"."device_tokens"',
  'COPY "public"."migration_id_map"',
  'COPY "public"."migration_checkpoints"',
  "COPY public.device_tokens",
  "COPY public.migration_id_map",
  "COPY public.migration_checkpoints",
]) {
  if (dataText.includes(forbidden)) throw new Error(`Unsafe backup relation present: ${forbidden}`);
}

const counts = copyCounts(dataText);
for (const required of [
  "profiles",
  "clients",
  "projects",
  "project_add_ons",
  "add_on_proposals",
  "receivables",
  "payments",
  "payment_allocations",
  "expenses",
  "tasks",
  "notifications",
  "mail_identities",
  "mail_identity_assignments",
  "mail_threads",
  "mail_messages",
]) {
  if (!(required in counts)) throw new Error(`Backup is missing required table ${required}.`);
}

const storage = JSON.parse(readFileSync(storageManifestPath, "utf8"));
const storageFiles = {};
const publicStorageManifest = {};
for (const bucket of ["profile-photos", "mail-attachments"]) {
  const summary = storage[bucket];
  if (!summary || !Array.isArray(summary.objects) || summary.object_count !== summary.objects.length) {
    throw new Error(`Storage bucket ${bucket} has an invalid manifest.`);
  }
  let totalBytes = 0;
  storageFiles[bucket] = [];
  publicStorageManifest[bucket] = { object_count: summary.object_count, total_bytes: summary.total_bytes, objects: [] };
  for (const object of summary.objects) {
    const objectPath = normalize(String(object.path || "")).replaceAll("\\", "/");
    const exportFile = String(object.export_file || "");
    if (!objectPath || objectPath.startsWith("/") || objectPath.includes("../") || isAbsolute(objectPath)) {
      throw new Error(`Storage bucket ${bucket} has an unsafe object path.`);
    }
    if (!exportFile || isAbsolute(exportFile) || normalize(exportFile).startsWith("..")) {
      throw new Error(`Storage bucket ${bucket} requires a bounded object export.`);
    }
    const exportedPath = resolve(dirname(storageManifestPath), exportFile);
    if (!existsSync(exportedPath)) throw new Error(`Storage bucket ${bucket} export is missing.`);
    const bytes = readFileSync(exportedPath);
    const checksum = sha256(bytes);
    if (bytes.length !== object.size_bytes || checksum !== object.sha256) {
      throw new Error(`Storage bucket ${bucket} export integrity check failed.`);
    }
    totalBytes += bytes.length;
    storageFiles[bucket].push({ path: objectPath, size_bytes: bytes.length, sha256: checksum, data_base64: bytes.toString("base64") });
    publicStorageManifest[bucket].objects.push({ path: objectPath, size_bytes: bytes.length, sha256: checksum });
  }
  if (totalBytes !== summary.total_bytes) throw new Error(`Storage bucket ${bucket} byte count does not match its manifest.`);
}

const capturedAt = new Date().toISOString();
const plaintext = Buffer.from(JSON.stringify({
  format: "KEN_CODE_PHASE6_DATABASE_V2",
  project_ref: PROJECT_REF,
  captured_at: capturedAt,
  schema_sha256: sha256(schema),
  data_sha256: sha256(data),
  schema_base64: schema.toString("base64"),
  data_base64: data.toString("base64"),
  storage_files: storageFiles,
}));
const compressed = gzipSync(plaintext, { level: 9 });
const key = randomBytes(32);
const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
const tag = cipher.getAuthTag();
const envelope = Buffer.concat([Buffer.from("KCP6D1"), iv, tag, encrypted]);
const protectedKey = dpapi("Protect", key.toString("base64"));
const recoveredKey = Buffer.from(dpapi("Unprotect", protectedKey), "base64");
if (!key.equals(recoveredKey)) throw new Error("DPAPI key recovery verification failed.");

const decipher = createDecipheriv("aes-256-gcm", recoveredKey, iv);
decipher.setAuthTag(tag);
const roundTrip = gunzipSync(Buffer.concat([decipher.update(encrypted), decipher.final()]));
if (!roundTrip.equals(plaintext)) throw new Error("AES-256-GCM round-trip verification failed.");

const outputDir = resolve(outputRoot);
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, "PHASE6_DB.kcbackup"), envelope, { mode: 0o600 });
writeFileSync(join(outputDir, "PHASE6_DB.key.dpapi"), `${protectedKey}\n`, { mode: 0o600 });
writeFileSync(join(outputDir, "storage-manifest.json"), `${JSON.stringify(publicStorageManifest, null, 2)}\n`, { mode: 0o600 });
const manifest = {
  format: "KEN_CODE_PHASE6_BACKUP_MANIFEST_V1",
  source: { provider: "supabase", project_ref: PROJECT_REF, schema: "public,private" },
  captured_at: capturedAt,
  protection: "AES-256-GCM; random key protected with Windows DPAPI CurrentUser",
  artifact_sha256: sha256(envelope),
  schema_sha256: sha256(schema),
  data_sha256: sha256(data),
  artifact_bytes: envelope.length,
  counts,
  storage: publicStorageManifest,
  excluded: {
    auth_schema: "Managed separately by Supabase; password hashes and Auth secrets excluded.",
    vault_and_platform_schemas: "Excluded by the official Supabase CLI dump.",
    device_tokens: "Excluded as credential material.",
    migration_metadata: "Excluded from the business payload; migrations remain versioned in Git.",
  },
  verification: "AES-256-GCM round-trip PASS",
};
writeFileSync(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
key.fill(0);
recoveredKey.fill(0);

console.log(JSON.stringify({
  status: "PASS",
  captured_at: capturedAt,
  artifact_directory: outputDir,
  artifact_sha256: manifest.artifact_sha256,
  artifact_bytes: manifest.artifact_bytes,
  counts,
  storage: publicStorageManifest,
  verification: manifest.verification,
}, null, 2));
