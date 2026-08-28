import { createClient } from "@supabase/supabase-js";
import { assertFirebaseSourceProject, assertSupabaseRemoteUrl, assertSupabaseTargetIdentity } from "../src/lib/migration/guards.ts";
import { readFirebaseSourceSnapshot } from "../src/lib/migration/firebase-source.ts";
import { deterministicChecksum, prepareMigrationRows } from "../src/lib/migration/preflight.ts";

const args = process.argv.slice(2);
if (!args.includes("--source-read") || !args.includes("--target-read")) throw new Error("Shadow comparison requires explicit source-read and target-read flags.");
const source = args.find((argument) => argument.startsWith("--project-id="))?.slice(13) ?? process.env.FIREBASE_PROJECT_ID;
assertFirebaseSourceProject(source);
assertSupabaseTargetIdentity({ projectRef: process.env.SUPABASE_PROJECT_REF, projectName: process.env.SUPABASE_PROJECT_NAME, organization: process.env.SUPABASE_ORGANIZATION, region: process.env.SUPABASE_REGION });
const targetUrl = assertSupabaseRemoteUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (!process.env.SUPABASE_SECRET_KEY) throw new Error("Shadow comparison secret is missing.");

const snapshot = await readFirebaseSourceSnapshot(source);
const prepared = prepareMigrationRows(snapshot.collections, snapshot.authUsers);
const client = createClient(targetUrl, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const { data: mappings, error: mappingsError } = await client.from("migration_id_map").select("source_collection,source_id,target_table,target_id,checksum").eq("source_system", "firebase");
if (mappingsError) throw new Error(`Shadow mapping read failed (${mappingsError.code ?? "unknown"}).`);
const mappingBySource = new Map((mappings ?? []).map((mapping) => [`${mapping.source_collection}\0${mapping.source_id}`, mapping]));

function normalize(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([nestedKey, nested]) => [nestedKey, normalize(nested, nestedKey)]));
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value.slice(0, 5);
    if (key.endsWith("_minor") && /^\d+$/.test(value)) return Number(value);
  }
  return value;
}

const summaries: Record<string, { source: number; target: number; matched: number; checksum: string }> = {};
let totalMatched = 0;
for (const table of [...new Set(prepared.rows.map((row) => row.targetTable))]) {
  const expectedRows = prepared.rows.filter((row) => row.targetTable === table);
  const targetRows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < expectedRows.length; offset += 100) {
    const ids = expectedRows.slice(offset, offset + 100).map((row) => row.targetId);
    if (!ids.length) continue;
    const { data, error } = await client.from(table).select("*").in("id", ids);
    if (error) throw new Error(`Shadow target read failed for ${table} (${error.code ?? "unknown"}).`);
    targetRows.push(...(data ?? []));
  }
  const targetById = new Map(targetRows.map((row) => [String(row.id), row]));
  const matchTokens: string[] = [];
  let matched = 0;
  for (const expected of expectedRows) {
    const mapping = mappingBySource.get(`${expected.sourceCollection}\0${expected.sourceId}`);
    const actual = targetById.get(expected.targetId);
    if (!mapping || mapping.target_id !== expected.targetId || mapping.target_table !== table || mapping.checksum !== expected.checksum || !actual) continue;
    const projectedActual = Object.fromEntries(Object.keys(expected.row).map((key) => [key, actual[key]]));
    const expectedChecksum = deterministicChecksum(normalize(expected.row));
    const actualChecksum = deterministicChecksum(normalize(projectedActual));
    if (expectedChecksum !== actualChecksum) continue;
    matched += 1;
    totalMatched += 1;
    matchTokens.push(`${expected.targetId}:${actualChecksum}`);
  }
  summaries[table] = { source: expectedRows.length, target: targetRows.length, matched, checksum: deterministicChecksum(matchTokens.sort()) };
}

const mismatches = Object.entries(summaries).filter(([, summary]) => summary.source !== summary.target || summary.source !== summary.matched).map(([table]) => table);
console.log(JSON.stringify({
  mode: "read-only-shadow",
  source,
  target: "Ken Code / kencodehn",
  transformedRows: prepared.rows.length,
  mappingRows: mappings?.length ?? 0,
  matchedRows: totalMatched,
  domains: summaries,
  mismatches,
  result: mismatches.length === 0 && totalMatched === prepared.rows.length && (mappings?.length ?? 0) === prepared.rows.length ? "MATCH" : "MISMATCH",
  piiLogged: false,
  secretsLogged: false,
}, null, 2));
if (mismatches.length || totalMatched !== prepared.rows.length) process.exitCode = 1;
