import { createDecipheriv, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const backupDirectory = process.argv[2];
const restoreDirectory = process.argv[3];
if (!backupDirectory || !restoreDirectory) {
  throw new Error("Usage: phase6-restore-backup <backup-directory> <isolated-output-directory>");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function unprotect(value) {
  const helper = join(process.cwd(), "scripts", "dpapi-key.ps1");
  return execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", helper, "-Mode", "Unprotect"],
    { encoding: "utf8", input: value },
  ).trim();
}

const artifactPath = join(backupDirectory, "PHASE6_DB.kcbackup");
const keyPath = join(backupDirectory, "PHASE6_DB.key.dpapi");
const manifestPath = join(backupDirectory, "manifest.json");
if (![artifactPath, keyPath, manifestPath].every(existsSync)) throw new Error("Backup set is incomplete.");

const artifact = readFileSync(artifactPath);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (artifact.subarray(0, 6).toString("utf8") !== "KCP6D1") throw new Error("Unknown backup format.");
if (sha256(artifact) !== manifest.artifact_sha256) throw new Error("Encrypted artifact checksum mismatch.");

const iv = artifact.subarray(6, 18);
const tag = artifact.subarray(18, 34);
const encrypted = artifact.subarray(34);
const key = Buffer.from(unprotect(readFileSync(keyPath, "utf8").trim()), "base64");
const decipher = createDecipheriv("aes-256-gcm", key, iv);
decipher.setAuthTag(tag);
const payload = JSON.parse(gunzipSync(Buffer.concat([decipher.update(encrypted), decipher.final()])).toString("utf8"));
const schema = Buffer.from(payload.schema_base64, "base64");
const data = Buffer.from(payload.data_base64, "base64");
if (sha256(schema) !== manifest.schema_sha256 || sha256(data) !== manifest.data_sha256) {
  throw new Error("Restored SQL checksum mismatch.");
}

const outputDir = resolve(restoreDirectory);
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, "schema.sql"), schema, { mode: 0o600 });
writeFileSync(join(outputDir, "data.sql"), data, { mode: 0o600 });
writeFileSync(join(outputDir, "restore-verification.json"), `${JSON.stringify({
  status: "PASS",
  source_captured_at: manifest.captured_at,
  artifact_sha256: manifest.artifact_sha256,
  schema_sha256: sha256(schema),
  data_sha256: sha256(data),
  counts: manifest.counts,
}, null, 2)}\n`, { mode: 0o600 });
key.fill(0);

console.log(JSON.stringify({
  status: "PASS",
  output_directory: outputDir,
  artifact_sha256: manifest.artifact_sha256,
  counts: manifest.counts,
}, null, 2));
