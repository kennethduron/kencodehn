import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const picker = readFileSync("src/components/admin/task-relation-picker.tsx", "utf8");

test("relation picker closes only when pointerdown occurs outside its root", () => {
  assert.match(picker, /rootRef\.current\?\.contains\(target\) \|\| listRef\.current\?\.contains\(target\)/);
  assert.match(picker, /document\.addEventListener\("pointerdown", handlePointerDown\)/);
  assert.match(picker, /document\.removeEventListener\("pointerdown", handlePointerDown\)/);
});

test("relation picker closes with Escape and cleans its keyboard listener", () => {
  assert.match(picker, /event\.key !== "Escape"/);
  assert.match(picker, /document\.addEventListener\("keydown", handleKeyDown\)/);
  assert.match(picker, /document\.removeEventListener\("keydown", handleKeyDown\)/);
});

test("Client, Prospect, and no-relation selection share the close path", () => {
  assert.match(picker, /function select\(option: TaskRelationOption \| null\)/);
  assert.match(picker, /onClick=\{\(\) => select\(item\)\}/);
  assert.match(picker, /onClick=\{\(\) => select\(null\)\}/);
  assert.match(picker, /item\.type === "client" \? "Cliente" : "Prospecto"/);
});

test("dropdown remains an anchored responsive overlay", () => {
  assert.match(picker, /createPortal/);
  assert.match(picker, /top: rect\.bottom \+ 6/);
  assert.match(picker, /Math\.min\(288, viewportHeight \* 0\.42, availableBelow\)/);
  assert.match(picker, /fixed z-\[70\] min-w-0 max-w-\[calc\(100vw-1rem\)\] overflow-x-hidden overflow-y-auto/);
});

test("result rows are compact and truncate long business text", () => {
  assert.match(picker, /min-h-\[3\.75rem\]/);
  assert.match(picker, /item\.label[\s\S]{0,100}truncate|truncate[\s\S]{0,100}item\.label/);
  assert.match(picker, /item\.detail[\s\S]{0,140}truncate|truncate[\s\S]{0,140}item\.detail/);
  assert.match(picker, /min-h-11[\s\S]{0,500}Sin relación/);
});

test("local loading and empty states use the required business copy", () => {
  assert.match(picker, /role="status">Buscando…/);
  assert.match(picker, /No se encontraron clientes o prospectos\./);
});

test("combobox exposes listbox and active-option semantics", () => {
  assert.match(picker, /role="combobox"/);
  assert.match(picker, /aria-expanded=\{open\}/);
  assert.match(picker, /aria-controls=\{listId\}/);
  assert.match(picker, /aria-activedescendant/);
  assert.match(picker, /role="listbox"/);
  assert.match(picker, /role="option"/);
});

test("keyboard navigation supports arrows and Enter without trapping Tab", () => {
  assert.match(picker, /event\.key === "ArrowDown"/);
  assert.match(picker, /event\.key === "ArrowUp"/);
  assert.match(picker, /event\.key === "Enter"/);
  assert.doesNotMatch(picker, /event\.key === "Tab"/);
});
