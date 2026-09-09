import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync("src/components/admin/mail-workspace.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");
const contextCard = workspace.slice(
  workspace.indexOf("function CrmContextCard"),
  workspace.indexOf("export function MailWorkspace"),
);

test("opened threads no longer reserve a fixed CRM context sidebar", () => {
  assert.doesNotMatch(workspace, /<aside[^>]+kc-mail-context/);
  assert.doesNotMatch(css, /grid-template-columns:[^;]+13\.5rem[^;]+15rem/);
  assert.doesNotMatch(css, /:has\(\.kc-mail-context\)/);
});

test("meaningful CRM relationships remain available in compact details", () => {
  assert.match(workspace, /contextEntries\.length \? <details className="kc-mail-context-details/);
  assert.match(workspace, /Relacionado con/);
  assert.match(workspace, /<CrmContextCard[^>]+entries=\{contextEntries\}/);
  assert.match(workspace, /`\/admin\/(clientes|leads|proyectos|modulos)\//);
});

test("responsible and follow-up metadata are not duplicated in CRM context", () => {
  assert.doesNotMatch(contextCard, /Responsable/);
  assert.doesNotMatch(contextCard, /Seguimiento/);
  assert.doesNotMatch(workspace, /contextEntries\.length \|\| responsibleName/);
});

test("operational controls use a container-driven wrapping grid", () => {
  assert.match(workspace, /id="mail-follow-up" className="kc-mail-follow-up[^\"]+w-full[^\"]+min-w-0/);
  assert.match(css, /\.kc-mail-follow-up \{[\s\S]*repeat\(auto-fit, minmax\(min\(100%, 13rem\), 1fr\)\)/);
  assert.match(css, /\.kc-mail-follow-up > \* \{ min-width: 0; \}/);
});

test("responsible, follow-up date, title and Create Task remain intact", () => {
  assert.match(workspace, /Responsable[\s\S]*assignThread\(event\.target\.value\)/);
  assert.match(workspace, /Seguimiento[\s\S]*value=\{followDue\}[\s\S]*setFollowDue/);
  assert.match(workspace, /Dar seguimiento[\s\S]*value=\{followTitle\}[\s\S]*setFollowTitle/);
  assert.match(workspace, /onClick=\{\(\) => void createFollowUp\(\)\}[\s\S]*kc-mail-follow-up-action[\s\S]*min-h-11[\s\S]*w-full[\s\S]*Crear tarea/);
});

test("thread actions wrap without a horizontal action scroller", () => {
  assert.match(workspace, /kc-mail-thread-actions[^\"]*flex-wrap/);
  assert.doesNotMatch(workspace, /kc-mail-thread-actions[^\"]*overflow-x-auto/);
  assert.match(workspace, /openReply\("reply"\)[\s\S]*openReply\("replyAll"\)[\s\S]*openReply\("forward"\)/);
  assert.match(workspace, /act\("archive"[\s\S]*act\("trash"/);
});

test("thread content and attachments use the expanded reader width safely", () => {
  assert.match(workspace, /mx-auto grid max-w-5xl gap-3/);
  assert.match(workspace, /Adjuntos del mensaje/);
  assert.match(workspace, /min-w-0 flex-1 truncate/);
  assert.match(css, /\.kc-mail-message-html img[\s\S]*max-width: 100% !important/);
});

test("phone, tablet and short-height rules remain active", () => {
  assert.match(css, /@media \(max-width: 1023px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /@media \(max-height: 650px\) and \(orientation: landscape\)/);
  assert.match(css, /\.kc-mail-action \{ min-height: 2\.75rem; \}/);
});
