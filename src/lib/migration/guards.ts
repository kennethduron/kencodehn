export type MigrationMode = {
  dryRun: boolean;
  sourceRead: boolean;
  write: boolean;
  confirmedSourceProject: string | null;
  confirmedTargetProjectRef: string | null;
  confirmedTargetProjectName: string | null;
  confirmedTargetOrganization: string | null;
  confirmedTargetRegion: string | null;
};

export const FIREBASE_CRM_SOURCE_PROJECT_ID = "kencode-81d66";
export const FIREBASE_LEGACY_EXCLUDED_PROJECT_ID = "kenneth-live-chat";
export const SUPABASE_TARGET_PROJECT_REF = "nvtrgrltyzrkljarvwff";
export const SUPABASE_TARGET_PROJECT_NAME = "kencodehn";
export const SUPABASE_TARGET_ORGANIZATION = "Ken Code";
export const SUPABASE_TARGET_REGION = "us-east-2";

function argumentValue(args: readonly string[], name: string) {
  return args.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1) || null;
}

export function assertFirebaseSourceProject(actual: string | null | undefined) {
  if (actual !== FIREBASE_CRM_SOURCE_PROJECT_ID) {
    throw new Error("Firebase source project mismatch; migration aborted before remote access.");
  }
  return actual;
}

export function assertSupabaseTargetIdentity(input: { projectRef?: string | null; projectName?: string | null; organization?: string | null; region?: string | null }) {
  if (
    input.projectRef !== SUPABASE_TARGET_PROJECT_REF
    || input.projectName !== SUPABASE_TARGET_PROJECT_NAME
    || input.organization !== SUPABASE_TARGET_ORGANIZATION
    || input.region !== SUPABASE_TARGET_REGION
  ) {
    throw new Error("Supabase target identity mismatch; migration aborted before remote write.");
  }
  return true;
}

export function assertSupabaseRemoteUrl(value: string | null | undefined) {
  let parsed: URL;
  try {
    parsed = new URL(value ?? "");
  } catch {
    throw new Error("Supabase target URL is invalid; migration aborted.");
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== `${SUPABASE_TARGET_PROJECT_REF}.supabase.co`) {
    throw new Error("Supabase target URL does not match the approved project ref; migration aborted.");
  }
  return parsed.toString().replace(/\/$/, "");
}

export function parseMigrationMode(args: readonly string[], env: NodeJS.ProcessEnv = process.env): MigrationMode {
  const write = args.includes("--write");
  const sourceRead = args.includes("--source-read") || write;
  const confirmedSourceProject = argumentValue(args, "--confirm-source-project");
  const confirmedTargetProjectRef = argumentValue(args, "--confirm-target-project-ref");
  const confirmedTargetProjectName = argumentValue(args, "--confirm-target-project-name");
  const confirmedTargetOrganization = argumentValue(args, "--confirm-target-organization");
  const confirmedTargetRegion = argumentValue(args, "--confirm-target-region");
  const mode = {
    dryRun: !write,
    sourceRead,
    write,
    confirmedSourceProject,
    confirmedTargetProjectRef,
    confirmedTargetProjectName,
    confirmedTargetOrganization,
    confirmedTargetRegion,
  };
  if (!write) return mode;
  if (env.MIGRATION_ALLOW_REMOTE_WRITE !== "true") {
    throw new Error("Remote migration writes require MIGRATION_ALLOW_REMOTE_WRITE=true.");
  }
  assertFirebaseSourceProject(env.FIREBASE_PROJECT_ID);
  assertFirebaseSourceProject(confirmedSourceProject);
  assertSupabaseTargetIdentity({
    projectRef: env.SUPABASE_PROJECT_REF,
    projectName: env.SUPABASE_PROJECT_NAME,
    organization: env.SUPABASE_ORGANIZATION,
    region: env.SUPABASE_REGION,
  });
  assertSupabaseRemoteUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  assertSupabaseTargetIdentity({
    projectRef: confirmedTargetProjectRef,
    projectName: confirmedTargetProjectName,
    organization: confirmedTargetOrganization,
    region: confirmedTargetRegion,
  });
  if (!env.SUPABASE_SECRET_KEY) throw new Error("SUPABASE_SECRET_KEY is required for a remote write.");
  return mode;
}
