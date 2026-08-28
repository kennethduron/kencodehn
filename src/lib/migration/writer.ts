import { deterministicChecksum, formatFirebaseScryptHash, MIGRATION_COLLECTION_ORDER, type FirebaseScryptParameters } from "./preflight.ts";
import { migrationMapRow, targetUuidForFirebase, type MigrationRow } from "./transform.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MigrationCheckpoint = {
  sourceCollection: string;
  batch: number;
  lastSourceId: string | null;
  processedCount: number;
  checksum: string;
  status: "completed";
  timestamp: string;
};

export type StoredMapping = ReturnType<typeof migrationMapRow>;
export type CommitResult = "inserted" | "idempotent" | "conflict";

export interface MigrationStore {
  commit(row: MigrationRow, mapping: StoredMapping): Promise<CommitResult>;
  getCheckpoint(sourceCollection: string, batch: number): Promise<MigrationCheckpoint | null>;
  saveCheckpoint(checkpoint: MigrationCheckpoint): Promise<void>;
}

export type AuthMigrationUser = {
  uid: string;
  email: string;
  emailVerified: boolean;
  disabled: boolean;
  passwordHash: string;
  passwordSalt: string;
};

export interface AuthMigrationStore {
  findById(id: string): Promise<{ id: string; email: string | null } | null>;
  create(input: { id: string; email: string; emailConfirm: boolean; banned: boolean; passwordHash: string }): Promise<"inserted" | "conflict">;
}

export async function migrateAuthUsers(
  users: readonly AuthMigrationUser[],
  store: AuthMigrationStore,
  parameters: FirebaseScryptParameters,
) {
  const results = { inserted: 0, idempotent: 0, conflicts: 0 };
  for (const user of users) {
    const id = targetUuidForFirebase("authUsers", user.uid);
    const email = user.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Auth migration user has an invalid email.");
    const existing = await store.findById(id);
    if (existing) {
      if (existing.email?.trim().toLowerCase() !== email) results.conflicts += 1;
      else results.idempotent += 1;
      continue;
    }
    const passwordHash = formatFirebaseScryptHash(user.passwordHash, user.passwordSalt, parameters);
    const outcome = await store.create({ id, email, emailConfirm: user.emailVerified, banned: user.disabled, passwordHash });
    if (outcome === "inserted") results.inserted += 1;
    else results.conflicts += 1;
  }
  if (results.conflicts) throw new MigrationConflictError(results.conflicts);
  return results;
}

export type StructuredMigrationLog = {
  event: "batch_completed" | "migration_completed" | "conflict" | "dry_run_completed";
  collection?: string;
  batch?: number;
  processed?: number;
  inserted?: number;
  idempotent?: number;
  conflicts?: number;
  checksum?: string;
};

export type MigrationWriterOptions = {
  write?: boolean;
  authorized?: boolean;
  batchSize?: number;
  now?: () => string;
  logger?: (entry: StructuredMigrationLog) => void;
  interruptAfterBatches?: number;
};

export class MigrationInterruptedError extends Error {
  constructor() {
    super("Sanitized migration interruption requested after a completed batch.");
    this.name = "MigrationInterruptedError";
  }
}

export class MigrationConflictError extends Error {
  readonly conflicts: number;

  constructor(conflicts: number) {
    super(`Migration stopped with ${conflicts} target conflict(s); no existing rows were overwritten.`);
    this.name = "MigrationConflictError";
    this.conflicts = conflicts;
  }
}

function orderedRows(rows: readonly MigrationRow[]) {
  const order = new Map(MIGRATION_COLLECTION_ORDER.map((collection, index) => [collection, index]));
  return [...rows].sort((left, right) => {
    const collectionOrder = (order.get(left.sourceCollection) ?? Number.MAX_SAFE_INTEGER)
      - (order.get(right.sourceCollection) ?? Number.MAX_SAFE_INTEGER);
    return collectionOrder || left.sourceId.localeCompare(right.sourceId);
  });
}

export async function runMigrationWriter(
  rows: readonly MigrationRow[],
  store: MigrationStore,
  options: MigrationWriterOptions = {},
) {
  const write = options.write === true;
  const batchSize = options.batchSize ?? 100;
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0) throw new Error("Migration batch size must be a positive integer.");
  if (write && options.authorized !== true) throw new Error("Writer authorization guard is required for writes.");
  const sorted = orderedRows(rows);
  const planChecksum = deterministicChecksum(sorted.map((row) => `${row.sourceCollection}:${row.sourceId}:${row.checksum}`));
  if (!write) {
    options.logger?.({ event: "dry_run_completed", processed: sorted.length, checksum: planChecksum });
    return { mode: "dry-run" as const, processed: sorted.length, inserted: 0, idempotent: 0, conflicts: 0, batches: 0, checksum: planChecksum };
  }

  let inserted = 0;
  let idempotent = 0;
  let conflicts = 0;
  let completedBatches = 0;
  for (const collection of MIGRATION_COLLECTION_ORDER) {
    const collectionRows = sorted.filter((row) => row.sourceCollection === collection);
    for (let offset = 0; offset < collectionRows.length; offset += batchSize) {
      const batchRows = collectionRows.slice(offset, offset + batchSize);
      const batch = Math.floor(offset / batchSize) + 1;
      const batchChecksum = deterministicChecksum(batchRows.map((row) => row.checksum));
      const existingCheckpoint = await store.getCheckpoint(collection, batch);
      if (existingCheckpoint && existingCheckpoint.checksum !== batchChecksum) {
        throw new Error("Checkpoint checksum mismatch; source snapshot changed and resume was aborted.");
      }
      for (const row of batchRows) {
        const outcome = await store.commit(row, migrationMapRow(row));
        if (outcome === "inserted") inserted += 1;
        else if (outcome === "idempotent") idempotent += 1;
        else {
          conflicts += 1;
          options.logger?.({ event: "conflict", collection: row.sourceCollection, conflicts });
        }
      }
      if (conflicts) throw new MigrationConflictError(conflicts);
      const checkpoint: MigrationCheckpoint = {
        sourceCollection: collection,
        batch,
        lastSourceId: batchRows.at(-1)?.sourceId ?? null,
        processedCount: offset + batchRows.length,
        checksum: batchChecksum,
        status: "completed",
        timestamp: options.now?.() ?? new Date().toISOString(),
      };
      await store.saveCheckpoint(checkpoint);
      completedBatches += 1;
      options.logger?.({ event: "batch_completed", collection, batch, processed: batchRows.length, checksum: batchChecksum });
      if (options.interruptAfterBatches === completedBatches) throw new MigrationInterruptedError();
    }
  }
  options.logger?.({ event: "migration_completed", processed: sorted.length, inserted, idempotent, conflicts: 0, checksum: planChecksum });
  return { mode: "write" as const, processed: sorted.length, inserted, idempotent, conflicts: 0, batches: completedBatches, checksum: planChecksum };
}

export class MemoryMigrationStore implements MigrationStore {
  readonly targets = new Map<string, Record<string, unknown>>();
  readonly mappings = new Map<string, StoredMapping>();
  readonly checkpoints = new Map<string, MigrationCheckpoint>();

  private targetKey(table: string, id: string) {
    return `${table}\u0000${id}`;
  }

  private mappingKey(mapping: StoredMapping) {
    return `${mapping.source_system}\u0000${mapping.source_collection}\u0000${mapping.source_id}\u0000${mapping.target_table}`;
  }

  async commit(row: MigrationRow, mapping: StoredMapping): Promise<CommitResult> {
    const mappingKey = this.mappingKey(mapping);
    const targetKey = this.targetKey(row.targetTable, row.targetId);
    const existingMapping = this.mappings.get(mappingKey);
    const existingTarget = this.targets.get(targetKey);
    if (existingMapping) {
      if (
        existingMapping.target_id !== mapping.target_id
        || existingMapping.target_table !== mapping.target_table
        || existingMapping.checksum !== mapping.checksum
        || !existingTarget
      ) return "conflict";
      return "idempotent";
    }
    if (existingTarget) return "conflict";
    this.targets.set(targetKey, structuredClone(row.row));
    this.mappings.set(mappingKey, { ...mapping });
    return "inserted";
  }

  async getCheckpoint(sourceCollection: string, batch: number) {
    return this.checkpoints.get(`${sourceCollection}\u0000${batch}`) ?? null;
  }

  async saveCheckpoint(checkpoint: MigrationCheckpoint) {
    const key = `${checkpoint.sourceCollection}\u0000${checkpoint.batch}`;
    const existing = this.checkpoints.get(key);
    if (existing && existing.checksum !== checkpoint.checksum) {
      throw new Error("Checkpoint consistency violation.");
    }
    this.checkpoints.set(key, { ...checkpoint });
  }

  seedUnexpectedTarget(table: string, id: string, row: Record<string, unknown>) {
    this.targets.set(this.targetKey(table, id), structuredClone(row));
  }
}

export class MemoryAuthMigrationStore implements AuthMigrationStore {
  readonly users = new Map<string, { id: string; email: string | null }>();

  async findById(id: string) {
    return this.users.get(id) ?? null;
  }

  async create(input: { id: string; email: string }) {
    if ([...this.users.values()].some((user) => user.email === input.email)) return "conflict" as const;
    this.users.set(input.id, { id: input.id, email: input.email });
    return "inserted" as const;
  }
}

export class SupabaseMigrationStore implements MigrationStore {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async commit(row: MigrationRow): Promise<CommitResult> {
    const { data, error } = await this.client.rpc("migration_commit_row", {
      p_source_collection: row.sourceCollection,
      p_source_id: row.sourceId,
      p_target_table: row.targetTable,
      p_target_id: row.targetId,
      p_checksum: row.checksum,
      p_row: row.row,
    });
    if (error) throw new Error(`Atomic migration commit failed (${error.code ?? "unknown"}).`);
    if (data !== "inserted" && data !== "idempotent" && data !== "conflict") {
      throw new Error("Atomic migration commit returned an invalid status.");
    }
    return data;
  }

  async getCheckpoint(sourceCollection: string, batch: number) {
    const { data, error } = await this.client
      .from("migration_checkpoints")
      .select("source_collection,batch,last_source_id,processed_count,checksum,status,completed_at")
      .eq("source_system", "firebase")
      .eq("source_collection", sourceCollection)
      .eq("batch", batch)
      .maybeSingle();
    if (error) throw new Error(`Migration checkpoint read failed (${error.code ?? "unknown"}).`);
    if (!data) return null;
    return {
      sourceCollection: String(data.source_collection),
      batch: Number(data.batch),
      lastSourceId: data.last_source_id ? String(data.last_source_id) : null,
      processedCount: Number(data.processed_count),
      checksum: String(data.checksum),
      status: "completed" as const,
      timestamp: String(data.completed_at),
    };
  }

  async saveCheckpoint(checkpoint: MigrationCheckpoint) {
    const { error } = await this.client.from("migration_checkpoints").upsert({
      source_system: "firebase",
      source_collection: checkpoint.sourceCollection,
      batch: checkpoint.batch,
      last_source_id: checkpoint.lastSourceId,
      processed_count: checkpoint.processedCount,
      checksum: checkpoint.checksum,
      status: checkpoint.status,
      completed_at: checkpoint.timestamp,
      metadata: {},
    }, { onConflict: "source_system,source_collection,batch" });
    if (error) throw new Error(`Migration checkpoint write failed (${error.code ?? "unknown"}).`);
  }
}

export class SupabaseAuthMigrationStore implements AuthMigrationStore {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async findById(id: string) {
    const { data, error } = await this.client.auth.admin.getUserById(id);
    if (error) {
      if (error.status === 404) return null;
      throw new Error(`Supabase Auth lookup failed (${error.status ?? "unknown"}).`);
    }
    return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
  }

  async create(input: { id: string; email: string; emailConfirm: boolean; banned: boolean; passwordHash: string }) {
    const { error } = await this.client.auth.admin.createUser({
      id: input.id,
      email: input.email,
      email_confirm: input.emailConfirm,
      ban_duration: input.banned ? "876000h" : "none",
      password_hash: input.passwordHash,
    });
    if (!error) return "inserted" as const;
    if (error.status === 409 || error.status === 422) return "conflict" as const;
    throw new Error(`Supabase Auth create failed (${error.status ?? "unknown"}).`);
  }
}
