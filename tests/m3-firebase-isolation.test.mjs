import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const admin = readFileSync("src/lib/firebase/admin.ts", "utf8");
const push = readFileSync("src/lib/push/service.ts", "utf8");
const repositories = readFileSync("src/lib/data/repositories/index.ts", "utf8");

test("Firebase Auth and Firestore have no eager runtime imports", () => {
  assert.doesNotMatch(admin, /^import\s+\{[^\n]+\}\s+from\s+["']firebase-admin\/(?:auth|firestore)["']/m);
  assert.match(admin, /import type \{ Auth \} from "firebase-admin\/auth"/);
  assert.match(admin, /import type \{ Firestore \} from "firebase-admin\/firestore"/);
});

test("Firebase services load only inside their explicit accessors", () => {
  assert.match(admin, /getAdminProjectId[\s\S]*serviceAccount\?\.projectId \?\? serviceAccount\?\.project_id/);
  assert.match(admin, /getAdminDb[\s\S]*requireFirebaseAdmin\("firebase-admin\/firestore"\)/);
  assert.match(admin, /getAdminAuth[\s\S]*requireFirebaseAdmin\("firebase-admin\/auth"\)/);
  assert.match(admin, /getAdminMessaging[\s\S]*requireFirebaseAdmin\("firebase-admin\/messaging"\)/);
});

test("Supabase repository selection does not import Firebase repositories", () => {
  assert.match(repositories, /if \(getCrmDataProvider\(\) === "supabase"\)[\s\S]*import\("@\/lib\/data\/repositories\/supabase"\)/);
  assert.match(repositories, /import\("@\/lib\/data\/repositories\/firebase"\)/);
  assert.doesNotMatch(repositories, /^import .*repositories\/firebase/m);
});

test("FCM remains active without an eager Firestore import", () => {
  assert.match(push, /getAdminMessaging\(\)/);
  assert.match(push, /messaging\.send\(/);
  assert.match(push, /getAdminServerTimestamp\(\)/);
  assert.match(admin, /getAdminServerTimestamp[\s\S]*FieldValue\.serverTimestamp\(\)/);
  assert.doesNotMatch(push, /^import .*firebase-admin\/firestore/m);
});
