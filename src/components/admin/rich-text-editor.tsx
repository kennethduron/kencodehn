"use client";

import { Bold, Italic, Link2, List, ListOrdered, Quote, Underline } from "lucide-react";
import { useEffect, useId, useRef } from "react";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  required?: boolean;
  minHeightClassName?: string;
};

function normalizedHtml(editor: HTMLDivElement) {
  const html = editor.innerHTML.trim();
  if (!editor.textContent?.trim() && /^(?:<br\s*\/?>(?:\s|&nbsp;)*)*$/i.test(html)) return "";
  return html;
}

export function RichTextEditor({
  value,
  onChange,
  label,
  placeholder = "Escriba su mensaje…",
  required = false,
  minHeightClassName = "min-h-52",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorId = useId();

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);

  function update() {
    const editor = editorRef.current;
    if (editor) onChange(normalizedHtml(editor));
  }

  function command(name: string, commandValue?: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(name, false, commandValue);
    update();
  }

  function addLink() {
    const url = window.prompt("Pegue la dirección completa del enlace:", "https://");
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) return;
      command("createLink", parsed.toString());
    } catch {
      // El servidor vuelve a validar y sanitizar el contenido antes de guardarlo.
    }
  }

  const toolbarButton = "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600";

  return (
    <div className="min-w-0">
      <span id={`${editorId}-label`} className="sr-only">{label}</span>
      <div className="flex max-w-full gap-1 overflow-x-auto rounded-t-xl border border-b-0 bg-slate-50 p-2" role="toolbar" aria-label="Formato del mensaje">
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")} className={toolbarButton} aria-label="Negrita"><Bold size={16} /></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")} className={toolbarButton} aria-label="Cursiva"><Italic size={16} /></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("underline")} className={toolbarButton} aria-label="Subrayado"><Underline size={16} /></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertUnorderedList")} className={toolbarButton} aria-label="Lista con viñetas"><List size={16} /></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("insertOrderedList")} className={toolbarButton} aria-label="Lista numerada"><ListOrdered size={16} /></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={addLink} className={toolbarButton} aria-label="Insertar enlace"><Link2 size={16} /></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("formatBlock", "blockquote")} className={toolbarButton} aria-label="Cita"><Quote size={16} /></button>
      </div>
      <div
        ref={editorRef}
        id={editorId}
        role="textbox"
        aria-multiline="true"
        aria-labelledby={`${editorId}-label`}
        aria-required={required}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={update}
        onBlur={update}
        className={`kc-rich-text-editor ${minHeightClassName} rounded-b-xl border px-3 py-3 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100`}
      />
      {required ? <input className="sr-only" tabIndex={-1} aria-hidden="true" required value={value ? "complete" : ""} onChange={() => undefined} /> : null}
    </div>
  );
}
