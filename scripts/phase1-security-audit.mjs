import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const envPath = process.argv[2] ?? ".env.phase1.audit.local";

function parseEnv(input) {
  const result = {};
  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[name] = value.replace(/\\n/g, "\n");
  }
  return result;
}

function walk(directory, accepted) {
  const files = [];
  try {
    for (const entry of readdirSync(directory)) {
      const absolute = join(directory, entry);
      const stat = statSync(absolute);
      if (stat.isDirectory()) files.push(...walk(absolute, accepted));
      else if (accepted(absolute)) files.push(absolute);
    }
  } catch {
    // A missing build directory is reported as zero files, not an audit failure.
  }
  return files;
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const secret = env.SUPABASE_SECRET_KEY ?? "";
const legacyNames = ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .map((file) => join(root, file));
const publicBuildFiles = walk(join(root, ".next", "static"), (file) => [".js", ".css", ".json", ".html"].includes(extname(file)));

function exactMatches(value, files) {
  if (!value) return [];
  return files.filter((file) => {
    try {
      return readFileSync(file).includes(Buffer.from(value));
    } catch {
      return false;
    }
  }).map((file) => relative(root, file));
}

const secretTracked = exactMatches(secret, tracked);
const secretPublicBuild = exactMatches(secret, publicBuildFiles);
const publishablePublicBuild = exactMatches(publishable, publicBuildFiles);
const legacyConfigured = legacyNames.filter((name) => Boolean(env[name]));
const trackedJwtLikeFiles = tracked.filter((file) => {
  try {
    return /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(readFileSync(file, "utf8"));
  } catch {
    return false;
  }
}).map((file) => relative(root, file));

const result = {
  publishable_key_format: publishable.startsWith("sb_publishable_") ? "PASS" : "FAIL",
  secret_key_format: secret.startsWith("sb_secret_") ? "PASS" : "FAIL",
  deprecated_supabase_env_names_configured: legacyConfigured,
  secret_exact_match_in_tracked_files: secretTracked,
  secret_exact_match_in_public_build: secretPublicBuild,
  publishable_present_in_public_build: publishablePublicBuild.length > 0,
  tracked_files_with_jwt_like_literal: trackedJwtLikeFiles,
  tracked_file_count: tracked.length,
  public_build_file_count: publicBuildFiles.length,
};

console.log(JSON.stringify(result, null, 2));
if (
  result.publishable_key_format !== "PASS"
  || result.secret_key_format !== "PASS"
  || legacyConfigured.length > 0
  || secretTracked.length > 0
  || secretPublicBuild.length > 0
  || trackedJwtLikeFiles.length > 0
) process.exitCode = 1;
