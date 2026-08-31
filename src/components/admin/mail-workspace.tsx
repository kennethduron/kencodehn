"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  AtSign,
  CalendarPlus,
  Check,
  Clock3,
  FileSignature,
  FileText,
  Forward,
  Inbox,
  Link2,
  ListOrdered,
  Loader2,
  Mail,
  MailOpen,
  Menu,
  Paperclip,
  PenLine,
  Quote,
  Reply,
  ReplyAll,
  Search,
  Send,
  Settings,
  Star,
  Trash2,
  Underline,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { AdminUser } from "@/lib/admin/types";
import { hasPermission } from "@/lib/admin/authorization";
import { Toast } from "./ui";

type Identity = { id?: string; email: string; display_name: string };
type Template = {
  id: string;
  name: string;
  subject: string;
  body_html: string;
};
type Signature = {
  id: string;
  identity_id: string | null;
  name: string;
  body_html: string;
  is_default: boolean;
};
type Relation = {
  name?: string;
  company?: string;
  proposal_number?: string;
  title?: string;
  status?: string;
};
type Assignee = {
  id: string;
  name?: string;
  display_name?: string;
  role: string;
};
type Thread = {
  id: string;
  subject: string;
  snippet: string;
  latest_message_at: string;
  state: string;
  assigned_to?: string | null;
  is_important: boolean;
  follow_up_at: string | null;
  lead_id?: string | null;
  client_id?: string | null;
  project_id?: string | null;
  add_on_id?: string | null;
  proposal_id?: string | null;
  leads?: Relation | Relation[];
  clients?: Relation | Relation[];
  projects?: Relation | Relation[];
  project_add_ons?: Relation | Relation[];
  add_on_proposals?: Relation | Relation[];
  mail_identities?: Identity | Identity[];
  mail_messages?: Array<{
    direction: string;
    from_address: { email?: string };
    to_addresses: Array<{ email?: string }>;
  }>;
};
type Message = {
  id: string;
  direction: string;
  from_address: { email?: string; name?: string };
  to_addresses: Array<{ email?: string }>;
  cc_addresses: Array<{ email?: string }>;
  subject: string;
  body_html: string;
  created_at: string;
  sent_at?: string;
  received_at?: string;
  has_remote_images?: boolean;
  delivery_status:
    | "received"
    | "queued"
    | "sent"
    | "delayed"
    | "delivered"
    | "failed"
    | "bounced"
    | "complained";
};
type Initial = {
  folder: string;
  threads: Thread[];
  drafts: Array<{
    id: string;
    subject: string;
    to_addresses: Array<{ email?: string }>;
    updated_at: string;
  }>;
  identities: Identity[];
  templates: Template[];
  signatures: Signature[];
  assignees: Assignee[];
  nextCursor: string | null;
  selected: { thread: Thread; messages: Message[] } | null;
};
type Context = {
  open: boolean;
  to: string;
  leadId?: string;
  clientId?: string;
  projectId?: string;
  addOnId?: string;
  proposalId?: string;
  clientName?: string;
  businessName?: string;
  projectName?: string;
  moduleName?: string;
  proposalNumber?: string;
};
const folderItems = [
  { id: "inbox", label: "Recibidos", icon: Inbox },
  { id: "sent", label: "Enviados", icon: Send },
  { id: "drafts", label: "Borradores", icon: FileText },
  { id: "follow-up", label: "Pendientes", icon: Clock3 },
  { id: "archived", label: "Archivados", icon: Archive },
  { id: "trash", label: "Papelera", icon: Trash2 },
];
function addresses(value: string) {
  return [
    ...new Set(
      value
        .split(/[,;\n]/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}
function identityOf(thread: Thread) {
  return Array.isArray(thread.mail_identities)
    ? thread.mail_identities[0]
    : thread.mail_identities;
}
function relation(value: Relation | Relation[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function MailWorkspace({
  admin,
  initial,
  composeContext,
}: {
  admin: AdminUser;
  initial: Initial;
  composeContext: Context;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();
  const [mobileFolders, setMobileFolders] = useState(false);
  const [compose, setCompose] = useState(composeContext.open);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [identityId, setIdentityId] = useState(initial.identities[0]?.id || "");
  const [to, setTo] = useState(composeContext.to);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCopies, setShowCopies] = useState(false);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [draft, setDraft] = useState<{ id?: string; version?: number }>({});
  const [attachments, setAttachments] = useState<
    Array<{ id: string; filename: string; size_bytes: number }>
  >([]);
  const [followDue, setFollowDue] = useState("");
  const [followTitle, setFollowTitle] = useState("Dar seguimiento al correo");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const signatureApplied = useRef(false);
  const sendRequestId = useRef<string | null>(null);
  const selected = initial.selected;
  const lastMessage = selected?.messages.at(-1);
  const clientContext = relation(selected?.thread.clients);
  const leadContext = relation(selected?.thread.leads);
  const projectContext = relation(selected?.thread.projects);
  const moduleContext = relation(selected?.thread.project_add_ons);
  const proposalContext = relation(selected?.thread.add_on_proposals);

  useEffect(() => {
    if (!compose) return;
    const isCompletelyEmpty =
      !draft.id &&
      !identityId &&
      !to &&
      !cc &&
      !bcc &&
      !subject &&
      !html &&
      !attachments.length &&
      !selected?.thread.id &&
      !composeContext.leadId &&
      !composeContext.clientId &&
      !composeContext.projectId &&
      !composeContext.addOnId &&
      !composeContext.proposalId;
    if (isCompletelyEmpty) return;
    const timer = setTimeout(async () => {
      const response = await fetch("/api/admin/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          id: draft.id,
          version: draft.version,
          identityId: identityId || null,
          threadId: selected?.thread.id || null,
          to: addresses(to),
          cc: addresses(cc),
          bcc: addresses(bcc),
          subject,
          html,
          context: {
            leadId: composeContext.leadId || null,
            clientId: composeContext.clientId || null,
            projectId: composeContext.projectId || null,
            addOnId: composeContext.addOnId || null,
            proposalId: composeContext.proposalId || null,
          },
        }),
      });
      if (response.ok) {
        const body = await response.json();
        setDraft(body.draft);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    bcc,
    cc,
    compose,
    composeContext,
    attachments.length,
    draft.id,
    draft.version,
    html,
    identityId,
    selected?.thread.id,
    subject,
    to,
  ]);

  async function discardDraft() {
    if (!draft.id) {
      sendRequestId.current = null;
      setCompose(false);
      return;
    }
    setBusy(true);
    setError("");
    const response = await fetch("/api/admin/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_draft", draftId: draft.id }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok)
      return setError(body.error || "No pudimos descartar el borrador.");
    setDraft({});
    setAttachments([]);
    setIdentityId("");
    setTo("");
    setCc("");
    setBcc("");
    setSubject("");
    setHtml("");
    setConfirmDiscard(false);
    sendRequestId.current = null;
    setCompose(false);
    setNotice("Borrador descartado.");
    router.refresh();
  }

  function openReply(mode: "reply" | "replyAll" | "forward") {
    if (!lastMessage) return;
    setCompose(true);
    setSubject(
      mode === "forward"
        ? /^fwd:/i.test(lastMessage.subject)
          ? lastMessage.subject
          : `Fwd: ${lastMessage.subject}`
        : /^re:/i.test(lastMessage.subject)
          ? lastMessage.subject
          : `Re: ${lastMessage.subject}`,
    );
    if (mode === "forward") {
      setTo("");
      setHtml(`<br><br><blockquote>${lastMessage.body_html}</blockquote>`);
    } else {
      const own = new Set(initial.identities.map((item) => item.email));
      const targets = [
        lastMessage.from_address.email,
        ...(mode === "replyAll"
          ? lastMessage.to_addresses.map((item) => item.email)
          : []),
        ...(mode === "replyAll"
          ? lastMessage.cc_addresses.map((item) => item.email)
          : []),
      ].filter((email): email is string => Boolean(email) && !own.has(email!));
      setTo([...new Set(targets)].join(", "));
      setHtml(`<br><br><blockquote>${lastMessage.body_html}</blockquote>`);
    }
  }
  async function act(action: string, threadId: string, value?: boolean) {
    setBusy(true);
    const response = await fetch("/api/admin/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, threadId, value }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json();
      return setError(body.error);
    }
    router.refresh();
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!identityId)
      return setError(
        "Necesita una identidad corporativa asignada para enviar.",
      );
    setBusy(true);
    setError("");
    const response = await fetch("/api/admin/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send",
        requestId:
          sendRequestId.current ||
          (sendRequestId.current = crypto.randomUUID()),
        threadId: selected?.thread.id,
        draftId: draft.id,
        identityId,
        to: addresses(to),
        cc: addresses(cc),
        bcc: addresses(bcc),
        subject,
        html,
      }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setError(body.error);
    sendRequestId.current = null;
    setNotice("Correo enviado correctamente.");
    setCompose(false);
    router.push(`/admin/mail?folder=sent&thread=${body.threadId}`);
    router.refresh();
  }
  async function uploadAttachment(file: File) {
    setBusy(true);
    setError("");
    let currentDraft = draft;
    if (!currentDraft.id) {
      const saved = await fetch("/api/admin/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          identityId: identityId || null,
          threadId: selected?.thread.id || null,
          to: addresses(to),
          cc: addresses(cc),
          bcc: addresses(bcc),
          subject,
          html,
          context: {
            leadId: composeContext.leadId || null,
            clientId: composeContext.clientId || null,
            projectId: composeContext.projectId || null,
            addOnId: composeContext.addOnId || null,
            proposalId: composeContext.proposalId || null,
          },
        }),
      });
      const body = await saved.json();
      if (!saved.ok) {
        setBusy(false);
        return setError(body.error);
      }
      currentDraft = body.draft;
      setDraft(currentDraft);
    }
    const form = new FormData();
    form.set("draftId", currentDraft.id!);
    form.set("file", file);
    const response = await fetch("/api/admin/mail/attachments", {
      method: "POST",
      body: form,
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setError(body.error);
    setAttachments((items) => [...items, body.attachment]);
    setNotice("Adjunto guardado en el borrador.");
  }
  async function openDraft(id: string) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/mail?folder=drafts&draft=${id}`, {
      cache: "no-store",
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok || !body.selectedDraft)
      return setError(body.error || "No pudimos abrir el borrador.");
    const item = body.selectedDraft;
    setDraft({ id: item.id, version: item.version });
    setIdentityId(item.identity_id || "");
    setTo(
      (item.to_addresses || [])
        .map((address: { email?: string }) => address.email)
        .filter(Boolean)
        .join(", "),
    );
    setCc(
      (item.cc_addresses || [])
        .map((address: { email?: string }) => address.email)
        .filter(Boolean)
        .join(", "),
    );
    setBcc(
      (item.bcc_addresses || [])
        .map((address: { email?: string }) => address.email)
        .filter(Boolean)
        .join(", "),
    );
    setShowCopies(
      Boolean(item.cc_addresses?.length || item.bcc_addresses?.length),
    );
    setSubject(item.subject || "");
    setHtml(item.body_html || "");
    setAttachments(item.attachments || []);
    signatureApplied.current = true;
    setCompose(true);
  }
  async function assignThread(profileId: string) {
    if (!selected) return;
    setBusy(true);
    const response = await fetch("/api/admin/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign",
        threadId: selected.thread.id,
        profileId: profileId || null,
      }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setError(body.error);
    setNotice("Responsable actualizado.");
    router.refresh();
  }
  async function createFollowUp() {
    if (!selected || !followDue)
      return setError("Seleccione fecha y hora para el seguimiento.");
    setBusy(true);
    const dueAt = new Date(followDue).toISOString();
    const response = await fetch("/api/admin/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "follow_up",
        threadId: selected.thread.id,
        dueAt,
        title: followTitle,
      }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setError(body.error);
    setNotice("Seguimiento creado en Tareas.");
    setFollowDue("");
    router.refresh();
  }
  function renderVariables(value: string) {
    const variables: Record<string, string> = {
      client_name:
        composeContext.clientName ||
        clientContext?.name ||
        leadContext?.name ||
        clientContext?.company ||
        leadContext?.company ||
        "",
      business_name:
        composeContext.businessName ||
        clientContext?.company ||
        leadContext?.company ||
        "",
      seller_name: admin.displayName || admin.email.split("@")[0],
      project_name: composeContext.projectName || projectContext?.name || "",
      proposal_number:
        composeContext.proposalNumber || proposalContext?.proposal_number || "",
      module_name: composeContext.moduleName || moduleContext?.name || "",
    };
    return value
      .replace(
        /\{\{\s*(client_name|business_name|seller_name|project_name|proposal_number|module_name)\s*\}\}/g,
        (_, key: string) => variables[key] || "",
      )
      .replace(/[ \t]+([,.;:])/g, "$1");
  }
  function applyTemplate(id: string) {
    const template = initial.templates.find((item) => item.id === id);
    if (template) {
      setSubject(renderVariables(template.subject));
      setHtml(renderVariables(template.body_html));
      signatureApplied.current = false;
    }
  }
  function applySignature(id: string) {
    const signature = initial.signatures.find((item) => item.id === id);
    if (!signature) return;
    const marker = `data-kc-signature=\"${signature.id}\"`;
    setHtml((value) =>
      value.includes(marker)
        ? value
        : `${value}${value ? "<br><br>" : ""}<div data-kc-signature=\"${signature.id}\">${signature.body_html}</div>`,
    );
    signatureApplied.current = true;
  }
  useEffect(() => {
    if (!compose || signatureApplied.current || html.trim()) return;
    const signature = initial.signatures.find(
      (item) =>
        item.is_default &&
        (!item.identity_id || item.identity_id === identityId),
    );
    if (signature) applySignature(signature.id);
  }, [compose, html, identityId, initial.signatures]);
  async function attachProposalPdf() {
    if (!composeContext.proposalId || !composeContext.addOnId) return;
    setBusy(true);
    setError("");
    const response = await fetch(
      `/api/admin/add-ons/proposals/${composeContext.proposalId}/pdf?module=${composeContext.addOnId}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      setBusy(false);
      return setError("No pudimos preparar el PDF de la propuesta.");
    }
    const disposition = response.headers.get("content-disposition") || "";
    const filename =
      disposition.match(/filename=\"([^\"]+)\"/)?.[1] ||
      "propuesta-ken-code.pdf";
    const file = new File([await response.blob()], filename, {
      type: "application/pdf",
    });
    await uploadAttachment(file);
  }
  function folderHref(id: string) {
    return `/admin/mail?folder=${id}`;
  }

  return (
    <div className="min-w-0">
      <Toast message={error || notice} variant={error ? "error" : "success"} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[.2em] text-blue-700">
            Comunicación comercial
          </p>
          <h1 className="font-display text-3xl font-black sm:text-4xl">
            Ken Code Mail
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/mail/configuracion"
            className="grid h-11 w-11 place-items-center rounded-xl border bg-white"
            aria-label="Configurar Mail"
          >
            <Settings size={19} />
          </Link>
          <button
            type="button"
            onClick={() => setCompose(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white"
          >
            <PenLine size={17} /> Redactar
          </button>
        </div>
      </div>
      {selected &&
      (clientContext ||
        leadContext ||
        projectContext ||
        moduleContext ||
        proposalContext) ? (
        <dl className="mb-3 flex flex-wrap gap-x-5 gap-y-2 rounded-xl border bg-white p-3 text-xs">
          <div>
            <dt className="font-bold text-kc-muted">Cliente</dt>
            <dd className="font-black">
              {clientContext?.company ||
                clientContext?.name ||
                leadContext?.company ||
                leadContext?.name ||
                "Sin vincular"}
            </dd>
          </div>
          {projectContext ? (
            <div>
              <dt className="font-bold text-kc-muted">Proyecto</dt>
              <dd className="font-black">{projectContext.name}</dd>
            </div>
          ) : null}
          {moduleContext ? (
            <div>
              <dt className="font-bold text-kc-muted">Módulo</dt>
              <dd className="font-black">{moduleContext.name}</dd>
            </div>
          ) : null}
          {proposalContext ? (
            <div>
              <dt className="font-bold text-kc-muted">Propuesta</dt>
              <dd className="font-black">
                {proposalContext.proposal_number || proposalContext.title}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <div className="kc-mail-shell overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <aside
          className={`kc-mail-folders border-r border-slate-200 bg-slate-50 p-3 ${mobileFolders ? "is-open" : ""}`}
        >
          <div className="mb-2 flex items-center justify-between lg:hidden">
            <strong>Carpetas</strong>
            <button
              type="button"
              onClick={() => setMobileFolders(false)}
              className="grid h-10 w-10 place-items-center"
            >
              <X size={18} />
            </button>
          </div>
          {folderItems.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={folderHref(id)}
              onClick={() => setMobileFolders(false)}
              className={`flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-bold ${initial.folder === id ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-white"}`}
            >
              <Icon size={17} /> {label}
            </Link>
          ))}
        </aside>
        <section
          className={`kc-mail-list min-w-0 border-r border-slate-200 ${selected ? "has-selection" : ""}`}
        >
          <div className="flex min-h-14 items-center gap-2 border-b border-slate-200 p-2">
            <button
              type="button"
              onClick={() => setMobileFolders(true)}
              className="grid h-10 w-10 place-items-center rounded-xl border lg:hidden"
              aria-label="Ver carpetas"
            >
              <Menu size={18} />
            </button>
            <form className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="absolute left-3 top-3 text-slate-400"
              />
              <input
                name="q"
                defaultValue={query.get("q") || ""}
                placeholder="Buscar correo..."
                className="min-h-10 w-full rounded-xl border pl-9 pr-3 text-sm"
              />
              <input type="hidden" name="folder" value={initial.folder} />
            </form>
          </div>
          <div className="max-h-[calc(100dvh-14rem)] overflow-y-auto">
            {initial.folder === "drafts"
              ? initial.drafts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void openDraft(item.id)}
                    className="w-full border-b border-slate-100 p-4 text-left hover:bg-slate-50"
                  >
                    <div className="flex justify-between gap-3">
                      <strong className="truncate text-sm">
                        {item.subject || "(Sin asunto)"}
                      </strong>
                      <span className="shrink-0 text-xs text-kc-muted">
                        {new Date(item.updated_at).toLocaleDateString("es-HN")}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-kc-muted">
                      Para:{" "}
                      {item.to_addresses
                        .map((address) => address.email)
                        .join(", ") || "Sin destinatario"}
                    </p>
                  </button>
                ))
              : initial.threads.map((thread) => (
                  <Link
                    key={thread.id}
                    href={`${pathname}?folder=${initial.folder}&thread=${thread.id}`}
                    className={`block border-b border-slate-100 p-4 hover:bg-slate-50 ${selected?.thread.id === thread.id ? "bg-blue-50" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-xs font-black text-blue-700">
                        {identityOf(thread)?.email || "Ken Code"}
                      </span>
                      <time className="shrink-0 text-[.68rem] text-kc-muted">
                        {new Date(thread.latest_message_at).toLocaleDateString(
                          "es-HN",
                        )}
                      </time>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <strong className="min-w-0 flex-1 truncate text-sm">
                        {thread.subject}
                      </strong>
                      {thread.is_important ? (
                        <Star
                          size={14}
                          className="fill-amber-400 text-amber-600"
                        />
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-kc-muted">
                      {thread.snippet || "Sin vista previa"}
                    </p>
                  </Link>
                ))}
            {!initial.threads.length && !initial.drafts.length ? (
              <div className="grid min-h-56 place-items-center p-6 text-center">
                <div>
                  <Mail className="mx-auto text-slate-300" />
                  <p className="mt-3 font-bold">Esta carpeta está vacía</p>
                  <p className="mt-1 text-sm text-kc-muted">
                    Las conversaciones aparecerán aquí.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          {initial.nextCursor ? (
            <div className="border-t p-2">
              <Link
                href={`${pathname}?folder=${initial.folder}&q=${encodeURIComponent(query.get("q") || "")}&cursor=${encodeURIComponent(initial.nextCursor)}`}
                className="flex min-h-10 items-center justify-center rounded-xl border text-sm font-bold text-blue-700"
              >
                Más conversaciones
              </Link>
            </div>
          ) : null}
        </section>
        <section
          className={`kc-mail-detail min-w-0 ${selected ? "is-open" : ""}`}
        >
          {selected ? (
            <>
              <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-4 backdrop-blur">
                <div className="flex items-start gap-2">
                  <Link
                    href={folderHref(initial.folder)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border lg:hidden"
                  >
                    <ArrowLeft size={18} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-display text-lg font-black">
                      {selected.thread.subject}
                    </h2>
                    <p className="mt-1 truncate text-xs text-kc-muted">
                      {identityOf(selected.thread)?.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      act(
                        "important",
                        selected.thread.id,
                        !selected.thread.is_important,
                      )
                    }
                    className="grid h-10 w-10 place-items-center rounded-xl border"
                    aria-label="Marcar importante"
                  >
                    <Star size={17} />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act("unread", selected.thread.id)}
                    className="grid h-10 w-10 place-items-center rounded-xl border"
                    aria-label="Marcar no leído"
                  >
                    <MailOpen size={17} />
                  </button>
                  {selected.thread.state !== "inbox" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act("restore", selected.thread.id)}
                      className="grid h-10 w-10 place-items-center rounded-xl border"
                      aria-label="Restaurar"
                    >
                      <Inbox size={17} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act("archive", selected.thread.id)}
                      className="grid h-10 w-10 place-items-center rounded-xl border"
                      aria-label="Archivar"
                    >
                      <Archive size={17} />
                    </button>
                  )}
                  {selected.thread.state !== "trash" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act("trash", selected.thread.id)}
                      className="grid h-10 w-10 place-items-center rounded-xl border text-rose-700"
                      aria-label="Mover a papelera"
                    >
                      <Trash2 size={17} />
                    </button>
                  ) : null}
                </div>
              </header>
              <div className="max-h-[calc(100dvh-18rem)] space-y-3 overflow-y-auto p-3 sm:p-5">
                {selected.messages.map((message) => (
                  <article
                    key={message.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <strong className="block break-all text-sm">
                          {message.from_address.name ||
                            message.from_address.email}
                        </strong>
                        <span className="block break-all text-xs text-kc-muted">
                          {message.from_address.email}
                        </span>
                      </div>
                      <time className="text-xs text-kc-muted">
                        {new Date(
                          message.received_at ||
                            message.sent_at ||
                            message.created_at,
                        ).toLocaleString("es-HN")}
                      </time>
                    </div>
                    {message.direction === "outbound" ? (
                      <p
                        className={`mt-2 text-xs font-bold ${
                          ["failed", "bounced", "complained"].includes(
                            message.delivery_status,
                          )
                            ? "text-rose-700"
                            : message.delivery_status === "delayed"
                              ? "text-amber-700"
                              : message.delivery_status === "delivered"
                                ? "text-emerald-700"
                                : "text-kc-muted"
                        }`}
                      >
                        {{
                          sent: "Enviado",
                          queued: "En cola",
                          delayed: "Entrega demorada",
                          delivered: "Entregado",
                          failed: "No entregado",
                          bounced: "Rebotado",
                          complained: "Marcado como spam",
                          received: "Recibido",
                        }[message.delivery_status]}
                      </p>
                    ) : null}
                    {message.has_remote_images ? (
                      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                        Imágenes externas bloqueadas para proteger su
                        privacidad.
                      </p>
                    ) : null}
                    <div
                      className="prose prose-sm mt-4 max-w-none break-words text-sm leading-6"
                      dangerouslySetInnerHTML={{ __html: message.body_html }}
                    />
                  </article>
                ))}
              </div>
              <footer className="border-t border-slate-200 p-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openReply("reply")}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold"
                  >
                    <Reply size={16} /> Responder
                  </button>
                  <button
                    onClick={() => openReply("replyAll")}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold"
                  >
                    <ReplyAll size={16} /> Responder a todos
                  </button>
                  <button
                    onClick={() => openReply("forward")}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold"
                  >
                    <Forward size={16} /> Reenviar
                  </button>
                </div>
                <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
                  {hasPermission(admin, "mail:assign_threads") ? (
                    <label className="grid gap-1 text-xs font-bold">
                      <span className="inline-flex items-center gap-1">
                        <UserRound size={14} /> Responsable
                      </span>
                      <select
                        defaultValue={selected.thread.assigned_to || ""}
                        onChange={(event) =>
                          void assignThread(event.target.value)
                        }
                        className="min-h-10 rounded-xl border px-3 text-sm"
                      >
                        <option value="">Sin asignar</option>
                        {initial.assignees.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.display_name || person.name || person.role}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <div className="grid gap-1 text-xs font-bold">
                    <span className="inline-flex items-center gap-1">
                      <CalendarPlus size={14} /> Seguimiento
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="datetime-local"
                        value={followDue}
                        onChange={(event) => setFollowDue(event.target.value)}
                        className="min-h-10 min-w-0 flex-1 rounded-xl border px-2 text-sm"
                        aria-label="Fecha de seguimiento"
                      />
                      <input
                        value={followTitle}
                        onChange={(event) => setFollowTitle(event.target.value)}
                        className="min-h-10 min-w-0 flex-[2] rounded-xl border px-2 text-sm"
                        aria-label="Título del seguimiento"
                      />
                      <button
                        type="button"
                        disabled={busy || !followDue}
                        onClick={() => void createFollowUp()}
                        className="min-h-10 rounded-xl bg-blue-700 px-3 text-xs font-black text-white disabled:opacity-50"
                      >
                        Crear tarea
                      </button>
                    </div>
                  </div>
                </div>
              </footer>
            </>
          ) : (
            <div className="grid min-h-[32rem] place-items-center p-8 text-center">
              <div>
                <AtSign className="mx-auto text-slate-300" size={34} />
                <h2 className="mt-4 font-display text-xl font-black">
                  Seleccione una conversación
                </h2>
                <p className="mt-2 text-sm text-kc-muted">
                  Lea, responda y vincule cada correo con el contexto comercial.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
      {compose ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Redactar correo"
        >
          <button
            className="absolute inset-0"
            onClick={() => setCompose(false)}
            aria-label="Cerrar redacción"
          />
          <form
            onSubmit={send}
            className="kc-mail-composer relative flex max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
          >
            <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
              <strong>Nuevo mensaje</strong>
              <button
                type="button"
                onClick={() => setCompose(false)}
                className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid gap-3">
                <label className="grid gap-1 text-xs font-bold">
                  De
                  <select
                    value={identityId}
                    onChange={(e) => {
                      setIdentityId(e.target.value);
                      signatureApplied.current = false;
                    }}
                    required
                    className="min-h-11 rounded-xl border px-3 text-sm"
                  >
                    <option value="">Seleccione una identidad</option>
                    {initial.identities.map((identity) => (
                      <option key={identity.id} value={identity.id}>
                        {identity.display_name} &lt;{identity.email}&gt;
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-bold">
                  Para
                  <input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    required
                    placeholder="cliente@empresa.com"
                    className="min-h-11 rounded-xl border px-3 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setShowCopies((value) => !value)}
                  className="justify-self-start text-xs font-bold text-blue-700"
                >
                  {showCopies ? "Ocultar CC/BCC" : "Agregar CC/BCC"}
                </button>
                {showCopies ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-bold">
                      CC
                      <input
                        value={cc}
                        onChange={(e) => setCc(e.target.value)}
                        className="min-h-11 rounded-xl border px-3 text-sm"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-bold">
                      BCC
                      <input
                        value={bcc}
                        onChange={(e) => setBcc(e.target.value)}
                        className="min-h-11 rounded-xl border px-3 text-sm"
                      />
                    </label>
                  </div>
                ) : null}
                <label className="grid gap-1 text-xs font-bold">
                  Asunto
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={998}
                    className="min-h-11 rounded-xl border px-3 text-sm"
                  />
                </label>
                {initial.templates.length ? (
                  <label className="grid gap-1 text-xs font-bold">
                    Plantilla
                    <select
                      defaultValue=""
                      onChange={(e) => applyTemplate(e.target.value)}
                      className="min-h-11 rounded-xl border px-3 text-sm"
                    >
                      <option value="">Sin plantilla</option>
                      {initial.templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {initial.signatures.length ? (
                  <label className="grid gap-1 text-xs font-bold">
                    <span className="inline-flex items-center gap-1">
                      <FileSignature size={14} /> Firma
                    </span>
                    <select
                      defaultValue=""
                      onChange={(e) => applySignature(e.target.value)}
                      className="min-h-11 rounded-xl border px-3 text-sm"
                    >
                      <option value="">Insertar firma</option>
                      {initial.signatures.map((signature) => (
                        <option key={signature.id} value={signature.id}>
                          {signature.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {composeContext.proposalId && composeContext.addOnId ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void attachProposalPdf()}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-800"
                  >
                    <FileText size={16} /> Adjuntar PDF de propuesta
                  </button>
                ) : null}
                <div className="flex gap-1 rounded-t-xl border border-b-0 bg-slate-50 p-2">
                  <button
                    type="button"
                    onClick={() =>
                      setHtml((value) => `${value}<strong>texto</strong>`)
                    }
                    className="grid h-9 w-9 place-items-center rounded-lg font-black hover:bg-white"
                    aria-label="Negrita"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => setHtml((value) => `${value}<em>texto</em>`)}
                    className="grid h-9 w-9 place-items-center rounded-lg italic hover:bg-white"
                    aria-label="Cursiva"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHtml((value) => `${value}<ul><li>Elemento</li></ul>`)
                    }
                    className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white"
                    aria-label="Lista con viñetas"
                  >
                    •
                  </button>
                  <button
                    type="button"
                    onClick={() => setHtml((value) => `${value}<u>texto</u>`)}
                    className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white"
                    aria-label="Subrayado"
                  >
                    <Underline size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHtml((value) => `${value}<ol><li>Elemento</li></ol>`)
                    }
                    className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white"
                    aria-label="Lista numerada"
                  >
                    <ListOrdered size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHtml(
                        (value) => `${value}<a href="https://">enlace</a>`,
                      )
                    }
                    className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white"
                    aria-label="Enlace"
                  >
                    <Link2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHtml(
                        (value) => `${value}<blockquote>cita</blockquote>`,
                      )
                    }
                    className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white"
                    aria-label="Cita"
                  >
                    <Quote size={16} />
                  </button>
                </div>
                <label className="sr-only" htmlFor="mail-body">
                  Mensaje
                </label>
                <textarea
                  id="mail-body"
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  required
                  rows={10}
                  placeholder="Escriba su mensaje…"
                  className="min-h-52 resize-y rounded-b-xl border px-3 py-3 font-sans text-sm leading-6"
                />
                {attachments.length ? (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((item) => (
                      <span
                        key={item.id}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold"
                      >
                        {item.filename} · {Math.ceil(item.size_bytes / 1024)} KB
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-center gap-2 text-xs text-kc-muted">
                  <Check size={14} />{" "}
                  {draft.id
                    ? "Borrador guardado"
                    : "Guardado automático activo"}
                </div>
              </div>
            </div>
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-bold">
                  <Paperclip size={16} /> Adjuntar
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.txt"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void uploadAttachment(file);
                    }}
                    disabled={busy}
                  />
                </label>
                {draft.id && !confirmDiscard ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmDiscard(true)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-200 px-3 text-sm font-bold text-rose-700 disabled:opacity-50"
                  >
                    <Trash2 size={16} /> Descartar borrador
                  </button>
                ) : null}
                {draft.id && confirmDiscard ? (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void discardDraft()}
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-rose-700 px-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      <Trash2 size={16} /> Confirmar descarte
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmDiscard(false)}
                      className="inline-flex min-h-10 items-center rounded-xl border px-3 text-sm font-bold"
                    >
                      Cancelar
                    </button>
                  </>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-11 min-w-28 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}{" "}
                Enviar
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
