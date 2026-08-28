# M2A readiness final — Firebase to Supabase

Date: 2026-08-28
Scope: source preflight, local transforms/tests and M2B writer preparation only

## Project identity

- CRM Firebase source: `kencode-81d66`.
- `kenneth-live-chat`: **Legacy unrelated Firebase project — excluded from CRM migration.** It was not inspected, modified, deployed, migrated or deleted.
- Supabase target: organization `Ken Code`, project `kencodehn`, ref `nvtrgrltyzrkljarvwff`, region `us-east-2`.
- Production continues on Firebase Auth, Firestore and FCM. No provider cutover was performed.
- `.firebaserc` keeps both projects with unambiguous aliases: `crm-production` and `legacy-live-chat`; `default` is the CRM source.

Every CRM source read requires the literal project ID `kencode-81d66`. The future remote writer additionally requires the exact source ID, Supabase ref/name/organization/region, exact project URL, `--write`, explicit confirmations for both ends, `MIGRATION_ALLOW_REMOTE_WRITE=true`, and the server secret. Missing or mismatched guards abort before writes.

## Read-only source result

| Collection | Source | Transformable | Insert-ready | Optional orphan FK occurrences |
|---|---:|---:|---:|---:|
| `adminUsers` | 1 | 1 | 1 | 0 |
| `leads` | 4 | 4 | 4 | 0 |
| `notes` | 0 | 0 | 0 | 0 |
| `tasks` | 28 | 28 | 28 | 0 |
| `notifications` | 172 | 172 | 172 | 4 |
| `activityLogs` | 275 | 275 | 275 | 6 |
| `emailLogs` | 120 | 120 | 120 | 3 |
| `pushLogs` | 113 | 113 | 113 | 3 |
| `deviceTokens` | 0 | 0 | 0 | 0 |
| `adminSettings` | 1 | 1 | 1 | 0 |
| `reminderEvents` | 0 | 0 | 0 | 0 |
| **Total** | **714** | **714** | **714** | **16** |

The 10 originally reported orphan rows remain exactly 4 notifications and 6 activity logs. The final FK-complete scan also found 3 email-log and 3 push-log occurrences that repeat the same missing task reference already present in the legacy history. Across all 16 FK occurrences there are only two distinct missing targets: one lead and one task. This additional correlation was previously outside the relationship audit; it is now covered and not discarded.

All optional orphan FKs become `NULL`. The source reference is preserved under `orphaned_references` in `legacy_data`, or in `activity_logs.metadata` where that is the existing equivalent. A source-null relation remains distinguishable because it has no orphan marker. Mandatory orphans abort; the real source has zero.

Other source checks:

- Auth users: 1; password users: 1; disabled: 0; duplicate email groups: 0.
- Owner invariant: exactly 1 active Owner, exactly 1 Auth mapping, exactly 1 future profile, `role=owner`, `active=true`.
- Firebase hash configuration: `SCRYPT`, rounds 8, memory cost 14; signer key and salt separator present and never logged.
- Money: 20 fields inspected; no negative, malformed, non-finite or over-precision values. Four leads use the documented USD fallback.
- Dates: 1,119 fields inspected; 0 malformed.
- Duplicate source IDs, profile/Auth email groups, reminder keys and device tokens: 0.
- Canonical transformed-plan checksum is stable across repeated reads: `8e927b7088e1a61383a8ed99ce1946d7940c863225ee3cd6135f11d1eb177014`.

## Firebase SCRYPT end-to-end

A sanitized local vector was generated in memory with the effective project parameters, converted to `$fbscrypt`, imported through the Supabase Auth local admin API and authenticated with the same test password. No real Owner email, password, hash or salt was used or logged.

Result: **PASS**. Password preservation confidence is high for the one current password user; predicted forced resets: **0**, subject to the same guarded import path during M2B.

## Final notifications policy

- Owner: own notifications and legacy rows with `recipient_id IS NULL`; private Sales Agent notifications remain hidden.
- Admin: own notifications and legacy rows; private Sales Agent notifications remain hidden.
- Sales Agent: only `recipient_id = auth.uid()`; other agents and legacy rows remain hidden.
- Manager/Viewer: no new inbox access.
- Global supervision continues through `activity_logs`.

The local database integration test used separate Owner, Admin, Sales Agent A and Sales Agent B sessions and verified these scopes through real RLS.

## M2B writer readiness

Order: Auth, profiles, leads, lead notes, tasks, notifications, activity logs, email logs, push logs, device tokens, admin settings, reminder events, with mapping/checkpoint metadata committed alongside the applicable row.

The writer supports deterministic UUIDs, batches, canonical checksums, atomic row+mapping commits, immutable `migration_id_map`, resumable checkpoints, idempotent Auth/data creation, conflict detection without overwrite, and structured count/checksum logs without document IDs, PII, password hashes or secrets. Checkpoints store only source collection, batch, last source ID, processed count, checksum, status and timestamp.

Local results with sanitized fixtures:

- first run intentionally interrupted after two completed batches;
- resume: 15 processed, 11 inserted, 4 already idempotent, 0 conflicts;
- duplicate run: 15 processed, 0 inserted, 15 idempotent, 0 conflicts;
- final migration maps: 15; checkpoints: 11;
- unexpected-target conflict through the real local atomic RPC: PASS, no overwrite; immutable-mapping simulation: PASS.

Normal execution remains dry-run. No remote writer was executed in M2A.

## Dependencies and compatibility

`npm audit` reports 8 moderate transitive findings in `uuid` through the Firebase Admin / Google Cloud dependency chain. The only offered full remediation is a breaking forced change that selects an old Firebase Admin major, so `npm audit fix --force` was not used. These paths are runtime-relevant while Firebase Admin remains active and are expected to shrink or disappear when Firebase Auth/Firestore support is retired; they remain tracked until then.

No financial tables, payment logic, reminders, cron changes, SMTP, email or push behavior were added. The current UUID/FK, timestamptz, currency-minor-unit and append-oriented history choices remain compatible with the future Client → Project/Service → Payment Plan → Installments/Receivables → Payments → Allocation → Balance/History model, higher-frequency schedulers and Resend delivery metadata. Nothing in M2A conflicts with future Supabase password recovery, expiring/used/invalid link handling, email confirmation or account Security UI.

No UI changed: **NO RESPONSIVE REGRESSION**.

## Decision

**READY FOR M2B REAL COPY**, while the real writer remains blocked and unexecuted.

No production Supabase business data or Auth users were created, no Vercel environment was changed, no provider cutover occurred, no cron ran, and no email or push was sent.
