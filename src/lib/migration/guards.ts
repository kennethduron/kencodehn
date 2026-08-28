export type MigrationMode = {
  dryRun: boolean;
  sourceRead: boolean;
  write: boolean;
  confirmedProjectRef: string | null;
};

export function parseMigrationMode(args: readonly string[], env: NodeJS.ProcessEnv = process.env): MigrationMode {
  const write = args.includes("--write");
  const sourceRead = args.includes("--source-read") || write;
  const confirmArgument = args.find((argument) => argument.startsWith("--confirm-project-ref="));
  const confirmedProjectRef = confirmArgument?.slice("--confirm-project-ref=".length) || null;
  if (!write) return { dryRun: true, sourceRead, write: false, confirmedProjectRef };
  if (env.MIGRATION_ALLOW_REMOTE_WRITE !== "true") {
    throw new Error("Remote migration writes require MIGRATION_ALLOW_REMOTE_WRITE=true.");
  }
  if (!confirmedProjectRef || confirmedProjectRef !== env.SUPABASE_PROJECT_REF) {
    throw new Error("Remote migration writes require an exact --confirm-project-ref match.");
  }
  if (!env.SUPABASE_SECRET_KEY) throw new Error("SUPABASE_SECRET_KEY is required for a remote write.");
  return { dryRun: false, sourceRead, write: true, confirmedProjectRef };
}

