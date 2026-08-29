import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb, getAdminProjectId } from "@/lib/firebase/admin";
import { isCrmPreviewReadOnly } from "@/lib/data/preview-read-only";
import {
  MIGRATION_COLLECTION_ORDER,
  deterministicChecksum,
  prepareMigrationRows,
  type AuthUserSummaryInput,
  type SourceCollections,
} from "@/lib/migration/preflight";
import { FIREBASE_CRM_SOURCE_PROJECT_ID } from "@/lib/migration/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store, max-age=0" };

function unavailable() {
  return NextResponse.json({ ok: false }, { status: 404, headers: noStore });
}

function normalize(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([nestedKey, nested]) => [nestedKey, normalize(nested, nestedKey)]));
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value.slice(0, 5);
    if (key.endsWith("_minor") && /^\d+$/.test(value)) return Number(value);
  }
  return value;
}

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview" || !isCrmPreviewReadOnly()) return unavailable();

  try {
    const db = getAdminDb();
    const auth = getAdminAuth();
    if (!db || !auth || getAdminProjectId() !== FIREBASE_CRM_SOURCE_PROJECT_ID) {
      throw new Error("Firebase source guard failed.");
    }

    const collectionEntries = await Promise.all(MIGRATION_COLLECTION_ORDER.map(async (collection) => {
      const snapshot = await db.collection(collection).get();
      return [collection, snapshot.docs.map((document) => ({ id: document.id, data: document.data() }))] as const;
    }));
    const collections = Object.fromEntries(collectionEntries) as SourceCollections;

    const authUsers: AuthUserSummaryInput[] = [];
    let pageToken: string | undefined;
    do {
      const page = await auth.listUsers(500, pageToken);
      authUsers.push(...page.users.map((user) => ({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        displayName: user.displayName,
        providerIds: user.providerData.map((provider) => provider.providerId),
        hasPasswordHash: Boolean(user.passwordHash),
      })));
      pageToken = page.pageToken;
    } while (pageToken);

    const prepared = prepareMigrationRows(collections, authUsers);
    const client = createSupabaseAdminClient();
    const { data: mappings, error: mappingsError } = await client.from("migration_id_map")
      .select("source_collection,source_id,target_table,target_id,checksum")
      .eq("source_system", "firebase");
    if (mappingsError) throw mappingsError;
    const mappingBySource = new Map((mappings ?? []).map((mapping) => [`${mapping.source_collection}\0${mapping.source_id}`, mapping]));

    const domains: Record<string, { source: number; target: number; matched: number; checksum: string }> = {};
    let totalMatched = 0;
    for (const table of [...new Set(prepared.rows.map((row) => row.targetTable))]) {
      const expectedRows = prepared.rows.filter((row) => row.targetTable === table);
      const targetRows: Record<string, unknown>[] = [];
      for (let offset = 0; offset < expectedRows.length; offset += 100) {
        const ids = expectedRows.slice(offset, offset + 100).map((row) => row.targetId);
        const { data, error } = await client.from(table).select("*").in("id", ids);
        if (error) throw error;
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
      domains[table] = {
        source: expectedRows.length,
        target: targetRows.length,
        matched,
        checksum: deterministicChecksum(matchTokens.sort()),
      };
    }

    const mismatches = Object.entries(domains)
      .filter(([, domain]) => domain.source !== domain.target || domain.source !== domain.matched)
      .map(([table]) => table);
    const sourceCounts = Object.fromEntries(MIGRATION_COLLECTION_ORDER.map((collection) => [collection, collections[collection]?.length ?? 0]));

    return NextResponse.json({
      ok: true,
      mode: "read-only-reconciliation",
      source: { project: FIREBASE_CRM_SOURCE_PROJECT_ID, authUsers: authUsers.length, documents: prepared.rows.length, collections: sourceCounts },
      target: { project: "nvtrgrltyzrkljarvwff", mappingRows: mappings?.length ?? 0 },
      transformedRows: prepared.rows.length,
      matchedRows: totalMatched,
      optionalOrphansPreserved: prepared.optionalOrphans,
      domains,
      mismatches,
      result: mismatches.length === 0 && totalMatched === prepared.rows.length && (mappings?.length ?? 0) === prepared.rows.length ? "MATCH" : "MISMATCH",
      piiReturned: false,
      secretsReturned: false,
    }, { headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, message: "Reconciliation audit unavailable." }, { status: 503, headers: noStore });
  }
}
