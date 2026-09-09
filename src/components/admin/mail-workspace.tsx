"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  AtSign,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileSignature,
  FileText,
  Forward,
  Inbox,
  Loader2,
  Mail,
  MailOpen,
  Menu,
  Paperclip,
  PenLine,
  Reply,
  ReplyAll,
  Search,
  Send,
  Settings,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { AdminUser } from "@/lib/admin/types";
import { hasPermission } from "@/lib/admin/authorization";
import { ConfirmDialog, Toast, Tooltip } from "./ui";
import { RichTextEditor } from "./rich-text-editor";
import { draftFingerprint, isMeaningfulDraft, type DraftAutosavePayload } from "@/lib/mail/draft-autosave";
import { formatHondurasDate, formatHondurasDateTime } from "@/lib/time";

type Identity = { id?: string; email: string; display_name: string; mail_identity_assignments?: Array<{ is_primary: boolean }> };
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
  source?: "personal" | "corporate";
  logo_url?: string | null;
  template_html?: string;
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
  last_outbound_at?: string | null;
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
  mail_read_states?: Array<{ profile_id: string; unread: boolean }>;
  mail_messages?: Array<{
    id: string;
    direction: string;
    delivery_status?: Message["delivery_status"];
    from_address: { email?: string; name?: string };
    to_addresses: Array<{ email?: string }>;
    sent_at?: string | null;
    created_at: string;
    mail_attachments?: Array<{ id: string }>;
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
  attachments?: Array<{ id: string; filename: string; content_type: string; size_bytes: number }>;
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
type ComposeMeta = {
  threadId: string | null;
  leadId: string | null;
  clientId: string | null;
  projectId: string | null;
  addOnId: string | null;
  proposalId: string | null;
};
type MailDeletionAssessment = {
  canDelete: boolean;
  reasonCode: string;
  reason: string;
  attachmentCount: number;
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

const deliveryLabels: Record<Message["delivery_status"], string> = {
  received: "Recibido",
  queued: "En cola",
  sent: "Enviado",
  delayed: "Entrega demorada",
  delivered: "Entregado",
  failed: "No entregado",
  bounced: "Rebotado",
  complained: "Marcado como spam",
};

function latestOutbound(thread: Thread) {
  return [...(thread.mail_messages || [])]
    .filter((message) => message.direction === "outbound")
    .sort((left, right) =>
      String(right.sent_at || right.created_at).localeCompare(
        String(left.sent_at || left.created_at),
      ),
    )[0];
}

function latestMessage(thread: Thread) {
  return [...(thread.mail_messages || [])].sort((left, right) =>
    String(right.sent_at || right.created_at).localeCompare(
      String(left.sent_at || left.created_at),
    ),
  )[0];
}

function conversationParty(thread: Thread, folder: string) {
  const message = folder === "sent" ? latestOutbound(thread) : latestMessage(thread);
  if (!message) return identityOf(thread)?.display_name || identityOf(thread)?.email || "Ken Code";
  if (folder === "sent" || message.direction === "outbound") {
    return message.to_addresses.map((address) => address.email).filter(Boolean).join(", ") || "Sin destinatario";
  }
  return message.from_address.name || message.from_address.email || "Remitente";
}

function initials(value: string) {
  const clean = value.includes("@") ? value.split("@")[0] : value;
  const parts = clean.trim().split(/[\s._-]+/).filter(Boolean);
  return `${parts[0]?.[0] || "K"}${parts.length > 1 ? parts.at(-1)?.[0] || "" : ""}`.toUpperCase();
}

function avatarTone(value: string) {
  const tones = ["bg-blue-100 text-blue-800", "bg-cyan-100 text-cyan-800", "bg-violet-100 text-violet-800", "bg-emerald-100 text-emerald-800", "bg-amber-100 text-amber-800"];
  const index = [...value].reduce((total, character) => total + character.charCodeAt(0), 0) % tones.length;
  return tones[index];
}

function readableSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

function formatMailListDate(value: string) {
  return new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", timeZone: "America/Tegucigalpa" }).format(new Date(value));
}

type ContextEntry = { label: string; value: string; href?: string };

function CrmContextCard({
  entries,
  headingId,
}: {
  entries: ContextEntry[];
  headingId: string;
}) {
  return (
    <section className="kc-mail-context-card rounded-2xl border border-slate-200 bg-slate-50/80 p-4" aria-labelledby={headingId}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-100 text-blue-700"><AtSign size={16} aria-hidden="true" /></span>
        <h3 id={headingId} className="text-sm font-black text-slate-900">Contexto en CRM</h3>
      </div>
      <dl className="mt-4 grid gap-3">
        {entries.map((item) => (
          <div key={`${item.label}-${item.value}`} className="min-w-0">
            <dt className="text-[.68rem] font-bold uppercase tracking-[.08em] text-slate-500">{item.label}</dt>
            <dd className="mt-0.5 min-w-0 text-sm font-bold text-slate-900">
              {item.href ? <Link href={item.href} className="inline-flex max-w-full items-center gap-1 text-blue-700 hover:underline"><span className="truncate">{item.value}</span><ExternalLink size={13} className="shrink-0" aria-hidden="true" /></Link> : <span className="block truncate">{item.value}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function MailWorkspace({
  admin,
  initial,
  composeContext,
  readOnlyPreview = false,
}: {
  admin: AdminUser;
  initial: Initial;
  composeContext: Context;
  readOnlyPreview?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();
  const [mobileFolders, setMobileFolders] = useState(false);
  const [compose, setCompose] = useState(composeContext.open);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [identityId, setIdentityId] = useState(initial.identities.find((item) => item.mail_identity_assignments?.some((assignment) => assignment.is_primary))?.id || (initial.identities.length === 1 ? initial.identities[0].id : "") || "");
  const [to, setTo] = useState(composeContext.to);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCopies, setShowCopies] = useState(false);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [draft, setDraft] = useState<{ id?: string; version?: number }>({});
  const [composeMeta, setComposeMeta] = useState<ComposeMeta>({
    threadId: initial.selected?.thread.id || null,
    leadId: composeContext.leadId || initial.selected?.thread.lead_id || null,
    clientId: composeContext.clientId || initial.selected?.thread.client_id || null,
    projectId: composeContext.projectId || initial.selected?.thread.project_id || null,
    addOnId: composeContext.addOnId || initial.selected?.thread.add_on_id || null,
    proposalId: composeContext.proposalId || initial.selected?.thread.proposal_id || null,
  });
  const [selectedSignatureId, setSelectedSignatureId] = useState("");
  const [attachments, setAttachments] = useState<
    Array<{ id: string; filename: string; size_bytes: number }>
  >([]);
  const [followDue, setFollowDue] = useState("");
  const [followTitle, setFollowTitle] = useState("Dar seguimiento al correo");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false);
  const [deleteAssessment, setDeleteAssessment] = useState<MailDeletionAssessment | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const signatureApplied = useRef(false);
  const draftRef = useRef(draft);
  const autosaveInFlight = useRef(false);
  const queuedAutosave = useRef<{ fingerprint: string; payload: DraftAutosavePayload } | null>(null);
  const lastSavedFingerprint = useRef("");
  const closeAfterAutosave = useRef(false);
  const composeTrigger = useRef<HTMLElement | null>(null);
  const sendRequestId = useRef<string | null>(null);
  const selected = initial.selected;
  const lastMessage = selected?.messages.at(-1);
  const clientContext = relation(selected?.thread.clients);
  const leadContext = relation(selected?.thread.leads);
  const projectContext = relation(selected?.thread.projects);
  const moduleContext = relation(selected?.thread.project_add_ons);
  const proposalContext = relation(selected?.thread.add_on_proposals);

  useEffect(() => { draftRef.current = draft; }, [draft]);

  function finishClosingComposer() {
    closeAfterAutosave.current = false;
    setCompose(false);
    window.setTimeout(() => composeTrigger.current?.focus(), 0);
  }

  async function persistAutosave(entry: { fingerprint: string; payload: DraftAutosavePayload }) {
    if (readOnlyPreview) return;
    if (autosaveInFlight.current) {
      queuedAutosave.current = entry;
      return;
    }
    if (entry.fingerprint === lastSavedFingerprint.current) return;
    autosaveInFlight.current = true;
    const currentDraft = draftRef.current;
    const response = await fetch("/api/admin/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save_draft", id: currentDraft.id, version: currentDraft.version, ...entry.payload }),
    }).catch(() => null);
    if (response?.ok) {
      const body = await response.json();
      draftRef.current = body.draft;
      setDraft(body.draft);
      lastSavedFingerprint.current = entry.fingerprint;
    } else {
      setError("No pudimos guardar los cambios. La redacción sigue abierta para proteger su borrador.");
    }
    autosaveInFlight.current = false;
    const queued = queuedAutosave.current;
    queuedAutosave.current = null;
    if (queued && queued.fingerprint !== lastSavedFingerprint.current) {
      void persistAutosave(queued);
    } else if (closeAfterAutosave.current && entry.fingerprint === lastSavedFingerprint.current) {
      finishClosingComposer();
    }
  }

  function currentAutosaveEntry() {
    const payload: DraftAutosavePayload = {
      identityId: identityId || null,
      signatureId: selectedSignatureId || null,
      threadId: composeMeta.threadId,
      to: addresses(to), cc: addresses(cc), bcc: addresses(bcc), subject, html,
      context: { leadId: composeMeta.leadId, clientId: composeMeta.clientId, projectId: composeMeta.projectId, addOnId: composeMeta.addOnId, proposalId: composeMeta.proposalId },
    };
    return { fingerprint: draftFingerprint(payload), payload };
  }

  function requestCloseComposer() {
    if (readOnlyPreview) return finishClosingComposer();
    const isCompletelyEmpty = !isMeaningfulDraft(currentAutosaveEntry().payload);
    if (isCompletelyEmpty) return finishClosingComposer();
    const entry = currentAutosaveEntry();
    if (entry.fingerprint === lastSavedFingerprint.current) return finishClosingComposer();
    closeAfterAutosave.current = true;
    void persistAutosave(entry);
  }

  useEffect(() => {
    if (!compose || readOnlyPreview) return;
    const isCompletelyEmpty = !isMeaningfulDraft(currentAutosaveEntry().payload);
    if (isCompletelyEmpty) return;
    const entry = currentAutosaveEntry();
    if (entry.fingerprint === lastSavedFingerprint.current) return;
    const timer = setTimeout(() => void persistAutosave(entry), 1500);
    return () => clearTimeout(timer);
  }, [
    bcc,
    cc,
    compose,
    composeMeta,
    html,
    identityId,
    readOnlyPreview,
    selectedSignatureId,
    subject,
    to,
  ]);

  async function discardDraft() {
    if (readOnlyPreview) return;
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
    draftRef.current = {};
    lastSavedFingerprint.current = "";
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
    if (!lastMessage || !selected) return;
    const quotedContainer = document.createElement("div");
    quotedContainer.innerHTML = lastMessage.body_html;
    quotedContainer.querySelectorAll("[data-kc-signature]").forEach((element) => element.remove());
    const quotedHtml = quotedContainer.innerHTML;
    composeTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    signatureApplied.current = false;
    closeAfterAutosave.current = false;
    setDraft({});
    draftRef.current = {};
    lastSavedFingerprint.current = "";
    setAttachments([]);
    setComposeMeta({
      threadId: selected.thread.id,
      leadId: selected.thread.lead_id || null,
      clientId: selected.thread.client_id || null,
      projectId: selected.thread.project_id || null,
      addOnId: selected.thread.add_on_id || null,
      proposalId: selected.thread.proposal_id || null,
    });
    setCompose(true);
    setSubject(
      mode === "forward"
        ? /^fwd:/i.test(lastMessage.subject)
          ? lastMessage.subject
          : `Reenviado: ${lastMessage.subject}`
        : /^re:/i.test(lastMessage.subject)
          ? lastMessage.subject
          : `Re: ${lastMessage.subject}`,
    );
    if (mode === "forward") {
      setTo("");
      setHtml(`<br><br><blockquote data-kc-quoted-history="true">${quotedHtml}</blockquote>`);
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
      setHtml(`<br><br><blockquote data-kc-quoted-history="true">${quotedHtml}</blockquote>`);
    }
  }
  async function preparePermanentDelete(threadId: string) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/mail?eligibility=hard_delete&thread=${encodeURIComponent(threadId)}`, { cache: "no-store" });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) return setError(body.error || "No pudimos comprobar esta conversación.");
    if (!body.canDelete) return setError(body.reason || "Esta conversación debe conservarse.");
    setDeleteAssessment(body);
    setDeleteReason("");
    setConfirmPermanentDelete(true);
  }
  async function act(action: string, threadId: string, value?: boolean) {
    if (readOnlyPreview) return;
    setBusy(true);
    const response = await fetch("/api/admin/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "hard_delete"
        ? { action, threadId, reason: deleteReason }
        : { action, threadId, value }),
    });
    const body = await response.json();
    setBusy(false);
    if (!response.ok) {
      return setError(body.error);
    }
    if (action === "hard_delete") {
      setConfirmPermanentDelete(false);
      setDeleteAssessment(null);
      setDeleteReason("");
      setNotice(body.cleanupPending
        ? "Conversación eliminada. La limpieza del adjunto quedó registrada para reintento."
        : "Conversación eliminada definitivamente.");
      router.push(folderHref("trash"));
      router.refresh();
      return;
    }
    router.refresh();
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    if (readOnlyPreview) return;
    if (!identityId)
      return setError(
        "Necesita una identidad corporativa asignada para enviar.",
      );
    setSending(true);
    setError("");
    let response: Response;
    let body: { error?: string; threadId?: string };
    try {
      response = await fetch("/api/admin/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          requestId:
            sendRequestId.current ||
            (sendRequestId.current = crypto.randomUUID()),
          threadId: composeMeta.threadId || undefined,
          draftId: draft.id,
          identityId,
          to: addresses(to),
          cc: addresses(cc),
          bcc: addresses(bcc),
          subject,
          html,
          signatureId: selectedSignatureId || null,
        }),
      });
      body = await response.json();
    } catch {
      setSending(false);
      return setError("No pudimos completar el envío. Inténtelo nuevamente.");
    }
    setSending(false);
    if (!response.ok) return setError(body.error || "No pudimos enviar el correo.");
    sendRequestId.current = null;
    setNotice("Correo enviado correctamente.");
    setCompose(false);
    router.push(`/admin/mail?folder=sent&thread=${body.threadId}`);
    router.refresh();
  }
  async function uploadAttachment(file: File) {
    if (readOnlyPreview) return;
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
          threadId: composeMeta.threadId,
          to: addresses(to),
          cc: addresses(cc),
          bcc: addresses(bcc),
          subject,
          html,
          signatureId: selectedSignatureId || null,
          context: {
            leadId: composeMeta.leadId,
            clientId: composeMeta.clientId,
            projectId: composeMeta.projectId,
            addOnId: composeMeta.addOnId,
            proposalId: composeMeta.proposalId,
          },
        }),
      });
      const body = await saved.json();
      if (!saved.ok) {
        setBusy(false);
        return setError(body.error);
      }
      currentDraft = body.draft;
      draftRef.current = currentDraft;
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
    composeTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeAfterAutosave.current = false;
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
    draftRef.current = { id: item.id, version: item.version };
    setIdentityId(initial.identities.some((identity) => identity.id === item.identity_id) ? item.identity_id || "" : "");
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
    setSelectedSignatureId(item.signature_selection || "");
    setAttachments(item.attachments || []);
    const restoredMeta: ComposeMeta = {
      threadId: item.thread_id || null,
      leadId: item.lead_id || null,
      clientId: item.client_id || null,
      projectId: item.project_id || null,
      addOnId: item.add_on_id || null,
      proposalId: item.proposal_id || null,
    };
    setComposeMeta(restoredMeta);
    lastSavedFingerprint.current = draftFingerprint({
      identityId: item.identity_id || null,
      signatureId: item.signature_selection || null,
      threadId: restoredMeta.threadId,
      to: (item.to_addresses || []).map((address: { email?: string }) => address.email).filter(Boolean),
      cc: (item.cc_addresses || []).map((address: { email?: string }) => address.email).filter(Boolean),
      bcc: (item.bcc_addresses || []).map((address: { email?: string }) => address.email).filter(Boolean),
      subject: item.subject || "",
      html: item.body_html || "",
      context: {
        leadId: restoredMeta.leadId,
        clientId: restoredMeta.clientId,
        projectId: restoredMeta.projectId,
        addOnId: restoredMeta.addOnId,
        proposalId: restoredMeta.proposalId,
      },
    });
    signatureApplied.current = Boolean(item.signature_selection);
    setCompose(true);
  }
  async function assignThread(profileId: string) {
    if (readOnlyPreview) return;
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
    if (readOnlyPreview) return;
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
    setSelectedSignatureId(signature.id);
    signatureApplied.current = true;
  }
  function signaturePreviewHtml(signature: Signature) {
    if (signature.source !== "corporate" || !signature.template_html) return signature.body_html;
    const selectedIdentity = initial.identities.find((item) => item.id === identityId);
    const safe = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
    const values: Record<string, string> = {
      USER_NAME: admin.displayName || admin.preferredName || admin.email.split("@")[0],
      ROLE_OR_TITLE: admin.jobTitle || ({ owner: "Owner", admin: "Administrador", manager: "Gerente", sales_agent: "Agente de ventas", viewer: "Consulta" }[admin.role]),
      CORPORATE_EMAIL: selectedIdentity?.email || "",
      COMPANY_NAME: "Ken Code",
      COMPANY_WEB: "kencodehn.com",
    };
    return signature.template_html.replace(/\{\{\s*(USER_NAME|ROLE_OR_TITLE|CORPORATE_EMAIL|COMPANY_NAME|COMPANY_WEB)\s*\}\}/g, (_, key: string) => safe(values[key] || ""));
  }
  useEffect(() => {
    if (!compose || signatureApplied.current) return;
    const compatible = initial.signatures.filter((item) => !item.identity_id || item.identity_id === identityId);
    const signature = compatible.find((item) => item.is_default && item.source === "corporate" && item.identity_id === identityId)
      || compatible.find((item) => item.is_default && item.source === "corporate" && !item.identity_id)
      || compatible.find((item) => item.is_default && item.identity_id === identityId)
      || compatible.find((item) => item.is_default);
    if (signature) applySignature(signature.id);
  }, [compose, identityId, initial.signatures]);

  useEffect(() => {
    if (!selected?.thread.id || readOnlyPreview) return;
    fetch("/api/admin/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", threadId: selected.thread.id }) }).catch(() => undefined);
  }, [readOnlyPreview, selected?.thread.id]);

  useEffect(() => {
    if (!mobileFolders) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileFolders]);

  useEffect(() => {
    if (!compose) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestCloseComposer();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [
    bcc,
    cc,
    compose,
    composeMeta,
    html,
    identityId,
    readOnlyPreview,
    selectedSignatureId,
    subject,
    to,
  ]);
  async function attachProposalPdf() {
    if (readOnlyPreview) return;
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

  const contextEntries: ContextEntry[] = selected ? [
    selected.thread.client_id && clientContext ? { label: "Cliente", value: clientContext.company || clientContext.name || "Cliente", href: `/admin/clientes/${selected.thread.client_id}` } : null,
    selected.thread.lead_id && leadContext ? { label: "Prospecto", value: leadContext.company || leadContext.name || "Prospecto", href: `/admin/leads/${selected.thread.lead_id}` } : null,
    selected.thread.project_id && projectContext ? { label: "Proyecto", value: projectContext.name || "Proyecto", href: `/admin/proyectos/${selected.thread.project_id}` } : null,
    selected.thread.add_on_id && moduleContext ? { label: "Módulo", value: moduleContext.name || "Módulo", href: `/admin/modulos/${selected.thread.add_on_id}` } : null,
    proposalContext ? { label: "Propuesta", value: proposalContext.proposal_number || proposalContext.title || "Propuesta" } : null,
  ].filter((item): item is ContextEntry => Boolean(item)) : [];
  const activeFolderCount = initial.folder === "drafts" ? initial.drafts.length : initial.threads.length;
  const activeFolderCountLabel = `${Math.min(activeFolderCount, 25)}${initial.nextCursor ? "+" : ""}`;
  const composerContextEntries: ContextEntry[] = [
    composeMeta.clientId ? { label: "Cliente", value: composeContext.businessName || composeContext.clientName || clientContext?.company || clientContext?.name || "Cliente", href: `/admin/clientes/${composeMeta.clientId}` } : null,
    composeMeta.leadId ? { label: "Prospecto", value: composeContext.clientName || leadContext?.company || leadContext?.name || "Prospecto", href: `/admin/leads/${composeMeta.leadId}` } : null,
    composeMeta.projectId ? { label: "Proyecto", value: composeContext.projectName || projectContext?.name || "Proyecto", href: `/admin/proyectos/${composeMeta.projectId}` } : null,
    composeMeta.addOnId ? { label: "Módulo", value: composeContext.moduleName || moduleContext?.name || "Módulo", href: `/admin/modulos/${composeMeta.addOnId}` } : null,
    composeMeta.proposalId ? { label: "Propuesta", value: composeContext.proposalNumber || proposalContext?.proposal_number || proposalContext?.title || "Propuesta" } : null,
  ].filter((item): item is ContextEntry => Boolean(item));

  return (
    <div className="kc-mail-page min-w-0">
      <Toast message={error || notice} variant={error ? "error" : "success"} />
      <div className="kc-mail-page-header mb-3 flex min-w-0 items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">
            Comunicación comercial
          </p>
          <h1 className="font-display text-2xl font-black sm:text-3xl">
            Ken Code Mail
          </h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <Tooltip label="Configuración">
            <Link
              href="/admin/mail/configuracion"
              className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-blue-200 hover:text-blue-700"
              aria-label="Configuración de Mail"
              title="Configuración de Mail"
            >
              <Settings size={19} aria-hidden="true" />
            </Link>
          </Tooltip>
          <button
            type="button"
            onClick={(event) => { composeTrigger.current = event.currentTarget; closeAfterAutosave.current = false; setCompose(true); }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-black text-white shadow-sm hover:bg-blue-800"
          >
            <PenLine size={17} /> Redactar
          </button>
        </div>
      </div>
      <div className="kc-mail-shell overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {mobileFolders ? <button type="button" className="kc-mail-folder-scrim fixed inset-0 z-[65] bg-slate-950/35 lg:hidden" onClick={() => setMobileFolders(false)} aria-label="Cerrar carpetas" /> : null}
        <aside
          className={`kc-mail-folders border-r border-slate-200 bg-slate-50/90 p-3 ${mobileFolders ? "is-open" : ""}`}
        >
          <div className="mb-2 flex items-center justify-between">
            <strong className="text-sm text-slate-900">Correo</strong>
            <button
              type="button"
              onClick={() => setMobileFolders(false)}
              className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white lg:hidden"
              aria-label="Cerrar carpetas"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {folderItems.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={folderHref(id)}
              onClick={() => setMobileFolders(false)}
              aria-current={initial.folder === id ? "page" : undefined}
              className={`kc-mail-folder-link relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold ${initial.folder === id ? "bg-blue-100 text-blue-800" : "text-slate-700 hover:bg-white hover:text-slate-950"}`}
            >
              <Icon size={17} aria-hidden="true" /> <span className="min-w-0 flex-1 truncate">{label}</span>
              {initial.folder === id ? <span className="rounded-full bg-white/80 px-2 py-0.5 text-[.68rem] font-black text-blue-700" aria-label={`${activeFolderCountLabel} elementos`}>{activeFolderCountLabel}</span> : null}
            </Link>
          ))}
          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="px-3 text-[.67rem] font-black uppercase tracking-[.14em] text-slate-400">Espacio de trabajo</p>
            <p className="mt-2 px-3 text-xs leading-5 text-slate-500">Correo comercial conectado con clientes y proyectos.</p>
          </div>
        </aside>
        <section
          className={`kc-mail-list min-w-0 border-r border-slate-200 ${selected ? "has-selection" : ""}`}
        >
          <div className="kc-mail-list-toolbar border-b border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileFolders(true)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 lg:hidden"
                aria-label="Ver carpetas"
              >
                <Menu size={18} aria-hidden="true" />
              </button>
              <form className="relative min-w-0 flex-1" role="search">
                <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" aria-hidden="true" />
                <input
                  name="q"
                  defaultValue={query.get("q") || ""}
                  placeholder="Buscar correo..."
                  aria-label="Buscar correo"
                  className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
                <input type="hidden" name="folder" value={initial.folder} />
              </form>
            </div>
            {initial.folder !== "drafts" ? <nav className="mt-2 flex gap-2 overflow-x-auto" aria-label="Filtros de correo">
              <Link href={folderHref(initial.folder === "follow-up" ? "inbox" : initial.folder)} className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-xs font-bold ${initial.folder !== "follow-up" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700"}`}>Todos</Link>
              <Link href={folderHref("follow-up")} className={`inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-bold ${initial.folder === "follow-up" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700"}`}><Clock3 size={14} aria-hidden="true" /> Seguimiento</Link>
            </nav> : null}
          </div>
          <div className="kc-mail-conversation-scroll overflow-y-auto">
            {initial.folder === "drafts"
              ? initial.drafts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void openDraft(item.id)}
                    className="kc-mail-row flex w-full min-w-0 gap-3 border-b border-slate-100 px-3 py-3 text-left hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"><FileText size={17} aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 justify-between gap-2">
                        <strong className="truncate text-sm text-slate-900">{item.subject || "(Sin asunto)"}</strong>
                        <time className="shrink-0 text-[.68rem] text-kc-muted">{formatHondurasDate(item.updated_at)}</time>
                      </div>
                      <p className="mt-1 truncate text-xs text-kc-muted">Para: {item.to_addresses.map((address) => address.email).join(", ") || "Sin destinatario"}</p>
                    </div>
                  </button>
                ))
              : initial.threads.map((thread) => {
                  const party = conversationParty(thread, initial.folder);
                  const unread = thread.mail_read_states?.find((state) => state.profile_id === admin.uid)?.unread === true;
                  const hasAttachments = thread.mail_messages?.some((message) => message.mail_attachments?.length);
                  const date = initial.folder === "sent" ? thread.last_outbound_at || latestOutbound(thread)?.sent_at || latestOutbound(thread)?.created_at || thread.latest_message_at : thread.latest_message_at;
                  return <Link
                      key={thread.id}
                      href={`${pathname}?folder=${initial.folder}&thread=${thread.id}`}
                      aria-current={selected?.thread.id === thread.id ? "true" : undefined}
                      className={`kc-mail-row relative flex min-w-0 gap-3 border-b border-slate-100 px-3 py-3 hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${selected?.thread.id === thread.id ? "is-selected bg-blue-50" : unread ? "bg-blue-50/35" : "bg-white"}`}
                    >
                      {unread ? <span className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-blue-600" aria-label="No leído" /> : null}
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-black ${avatarTone(party)}`} aria-hidden="true">{initials(party)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          <span className={`truncate text-sm text-slate-900 ${unread ? "font-black" : "font-bold"}`}>{initial.folder === "sent" ? `Para: ${party}` : party}</span>
                          <time className={`shrink-0 text-[.67rem] ${unread ? "font-bold text-blue-700" : "text-kc-muted"}`} dateTime={date}>{formatMailListDate(date)}</time>
                        </div>
                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                          <strong className={`min-w-0 flex-1 truncate text-xs text-slate-800 ${unread ? "font-black" : "font-bold"}`}>{thread.subject}</strong>
                          {hasAttachments ? <Paperclip size={13} className="shrink-0 text-slate-500" aria-label="Con adjuntos" /> : null}
                          {thread.follow_up_at ? <Clock3 size={13} className="shrink-0 text-violet-600" aria-label="En seguimiento" /> : null}
                          {thread.is_important ? <Star size={14} className="shrink-0 fill-amber-400 text-amber-500" aria-label="Importante" /> : null}
                        </div>
                        <div className="mt-1 flex min-w-0 items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-xs text-kc-muted">{thread.snippet || "Sin vista previa"}</p>
                          {initial.folder === "sent" && latestOutbound(thread)?.delivery_status ? <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[.62rem] font-bold text-emerald-700">{deliveryLabels[latestOutbound(thread)!.delivery_status as Message["delivery_status"]]}</span> : null}
                        </div>
                      </div>
                    </Link>;
                })}
            {!initial.threads.length && !initial.drafts.length ? (
              <div className="grid min-h-56 place-items-center p-6 text-center">
                <div>
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-500"><Mail size={22} aria-hidden="true" /></span>
                  <p className="mt-3 font-bold">{query.get("q") ? "No se encontraron conversaciones" : "Esta carpeta está vacía"}</p>
                  <p className="mt-1 text-sm text-kc-muted">
                    {query.get("q") ? "Pruebe con otro nombre, correo o asunto." : "Las conversaciones aparecerán aquí."}
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
              <header className="kc-mail-thread-header border-b border-slate-200 bg-white">
                <div className="flex min-w-0 items-start gap-2 px-3 pb-2 pt-3 sm:px-4">
                  <Link
                    href={folderHref(initial.folder)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 xl:hidden"
                    aria-label="Volver a conversaciones"
                  >
                    <ArrowLeft size={18} aria-hidden="true" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-display text-lg font-black leading-tight text-slate-950 sm:text-xl">
                      {selected.thread.subject}
                    </h2>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-kc-muted">
                      <span className="truncate">{selected.messages.length} {selected.messages.length === 1 ? "mensaje" : "mensajes"}</span>
                      {selected.thread.follow_up_at ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">En seguimiento</span> : null}
                    </div>
                  </div>
                  <Tooltip label={selected.thread.is_important ? "Quitar importante" : "Marcar como importante"} placement="bottom">
                    <button
                      type="button"
                      disabled={busy || readOnlyPreview}
                      onClick={() =>
                        act(
                          "important",
                          selected.thread.id,
                          !selected.thread.is_important,
                        )
                      }
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 ${selected.thread.is_important ? "bg-amber-50 text-amber-600" : "text-slate-600"}`}
                      aria-label={selected.thread.is_important ? "Quitar importante" : "Marcar como importante"}
                      title={selected.thread.is_important ? "Quitar importante" : "Marcar como importante"}
                    >
                      <Star size={17} className={selected.thread.is_important ? "fill-amber-400" : ""} aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
                <div className="kc-mail-thread-actions flex min-w-0 flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2 sm:px-4" aria-label="Acciones de conversación">
                  <button type="button" onClick={() => openReply("reply")} className="kc-mail-action" aria-label="Responder" title="Responder"><Reply size={15} aria-hidden="true" /><span>Responder</span></button>
                  <button type="button" onClick={() => openReply("replyAll")} className="kc-mail-action" aria-label="Responder a todos" title="Responder a todos"><ReplyAll size={15} aria-hidden="true" /><span>Responder a todos</span></button>
                  <button type="button" onClick={() => openReply("forward")} className="kc-mail-action" aria-label="Reenviar" title="Reenviar"><Forward size={15} aria-hidden="true" /><span>Reenviar</span></button>
                  <button type="button" disabled={busy || readOnlyPreview} onClick={() => act("unread", selected.thread.id)} className="kc-mail-action" aria-label="Marcar como no leído" title="Marcar como no leído"><MailOpen size={15} aria-hidden="true" /><span>No leído</span></button>
                  {selected.thread.state !== "inbox" ? <button type="button" disabled={busy || readOnlyPreview} onClick={() => act("restore", selected.thread.id)} className="kc-mail-action" aria-label="Restaurar" title="Restaurar"><Inbox size={15} aria-hidden="true" /><span>Restaurar</span></button> : <Tooltip label="Archivar" placement="bottom"><button type="button" disabled={busy || readOnlyPreview} onClick={() => act("archive", selected.thread.id)} className="kc-mail-action" aria-label="Archivar" title="Archivar"><Archive size={15} aria-hidden="true" /><span>Archivar</span></button></Tooltip>}
                  {selected.thread.state !== "trash" ? <Tooltip label="Mover a Papelera" placement="bottom"><button type="button" disabled={busy || readOnlyPreview} onClick={() => act("trash", selected.thread.id)} className="kc-mail-action text-rose-700" aria-label="Mover a Papelera" title="Mover a Papelera"><Trash2 size={15} aria-hidden="true" /><span>Papelera</span></button></Tooltip> : admin.role === "owner" ? <Tooltip label="Eliminar definitivamente" placement="bottom"><button type="button" disabled={busy || readOnlyPreview} onClick={() => void preparePermanentDelete(selected.thread.id)} className="kc-mail-action text-rose-700" aria-label="Eliminar definitivamente" title="Eliminar definitivamente"><Trash2 size={15} aria-hidden="true" /><span>Eliminar</span></button></Tooltip> : null}
                  <a href="#mail-follow-up" className="kc-mail-action" aria-label="Seguimiento" title="Seguimiento"><CalendarPlus size={15} aria-hidden="true" /><span>Seguimiento</span></a>
                </div>
              </header>
              <div className="kc-mail-thread-layout min-h-0">
                <div className="kc-mail-thread-scroll min-w-0 overflow-y-auto bg-slate-50/40 p-3 sm:p-4">
                  <div className="mx-auto grid max-w-5xl gap-3">
                    {selected.messages.map((message) => {
                      const sender = message.from_address.name || message.from_address.email || "Remitente";
                      return <article key={message.id} className={`kc-mail-message min-w-0 rounded-2xl border p-4 shadow-sm ${message.direction === "outbound" ? "border-blue-100 bg-blue-50/35" : "border-slate-200 bg-white"}`}>
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-black ${avatarTone(sender)}`} aria-hidden="true">{initials(sender)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-1">
                              <div className="min-w-0"><strong className="block truncate text-sm text-slate-950">{sender}</strong><span className="block truncate text-xs text-kc-muted">{message.from_address.email}</span></div>
                              <div className="flex shrink-0 items-center gap-2"><time className="text-[.7rem] text-kc-muted">{formatHondurasDateTime(message.received_at || message.sent_at || message.created_at)}</time>{message.direction === "outbound" ? <span className={`rounded-full px-2 py-0.5 text-[.65rem] font-bold ${["failed", "bounced", "complained"].includes(message.delivery_status) ? "bg-rose-100 text-rose-700" : message.delivery_status === "delayed" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{deliveryLabels[message.delivery_status]}</span> : null}</div>
                            </div>
                            <p className="mt-1 truncate text-xs text-kc-muted">Para: {message.to_addresses.map((address) => address.email).filter(Boolean).join(", ") || "Sin destinatario"}</p>
                          </div>
                        </div>
                        {message.has_remote_images ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Imágenes externas bloqueadas para proteger su privacidad.</p> : null}
                        <div className="kc-mail-message-html prose prose-sm mt-4 max-w-none break-words text-sm leading-6" dangerouslySetInnerHTML={{ __html: message.body_html }} />
                        {message.attachments?.length ? <div className="mt-4 grid gap-2 border-t border-slate-100 pt-3" aria-label="Adjuntos del mensaje">
                          {message.attachments.map((attachment) => <a key={attachment.id} href={`/api/admin/mail/attachments?id=${encodeURIComponent(attachment.id)}`} className="flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-blue-800 hover:border-blue-300" download>
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-700"><FileText size={17} aria-hidden="true" /></span><span className="min-w-0 flex-1 truncate">{attachment.filename}</span><span className="shrink-0 text-xs font-normal text-kc-muted">{attachment.content_type.split("/").at(-1)?.toUpperCase()} · {readableSize(attachment.size_bytes)}</span>
                          </a>)}
                        </div> : null}
                      </article>;
                    })}
                    {contextEntries.length ? <details className="kc-mail-context-details rounded-2xl border border-slate-200 bg-white">
                      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-black"><span className="inline-flex min-w-0 items-center gap-2"><AtSign size={16} className="shrink-0 text-blue-700" aria-hidden="true" /><span className="truncate">Relacionado con</span></span><ChevronDown size={17} className="shrink-0" aria-hidden="true" /></summary>
                      <div className="border-t border-slate-100 p-3"><CrmContextCard headingId="crm-context-details-title" entries={contextEntries} /></div>
                    </details> : null}
                    <button type="button" onClick={() => openReply("reply")} className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-left text-sm text-slate-500 shadow-sm hover:border-blue-300 hover:text-blue-700"><Reply size={17} aria-hidden="true" /><span className="min-w-0 flex-1">Escriba una respuesta...</span><ChevronRight size={17} aria-hidden="true" /></button>
                  </div>
                  <div id="mail-follow-up" className="kc-mail-follow-up mx-auto mt-3 w-full max-w-5xl min-w-0 gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                  {hasPermission(admin, "mail:assign_threads") ? (
                    <label className="grid min-w-0 gap-1 text-xs font-bold">
                      <span className="inline-flex items-center gap-1">
                        <UserRound size={14} /> Responsable
                      </span>
                      <select
                        defaultValue={selected.thread.assigned_to || ""}
                        disabled={busy || readOnlyPreview}
                        onChange={(event) =>
                          void assignThread(event.target.value)
                        }
                        className="min-h-11 w-full min-w-0 rounded-xl border px-3 text-sm"
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
                  <label className="grid min-w-0 gap-1 text-xs font-bold">
                    <span className="inline-flex items-center gap-1">
                      <CalendarPlus size={14} /> Seguimiento
                    </span>
                    <input
                      type="datetime-local"
                      value={followDue}
                      onChange={(event) => setFollowDue(event.target.value)}
                      className="min-h-11 w-full min-w-0 rounded-xl border px-3 text-sm"
                      aria-label="Fecha de seguimiento"
                    />
                  </label>
                  <label className="grid min-w-0 gap-1 text-xs font-bold">
                    <span>Dar seguimiento</span>
                    <input
                      value={followTitle}
                      onChange={(event) => setFollowTitle(event.target.value)}
                      className="min-h-11 w-full min-w-0 rounded-xl border px-3 text-sm"
                      aria-label="Título del seguimiento"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || readOnlyPreview || !followDue}
                    onClick={() => void createFollowUp()}
                    className="kc-mail-follow-up-action min-h-11 w-full whitespace-nowrap rounded-xl bg-blue-700 px-4 text-sm font-black text-white disabled:opacity-50"
                  >
                    Crear tarea
                  </button>
                  </div>
                </div>
              </div>
              <nav className="kc-mail-mobile-actions" aria-label="Acciones rápidas">
                <button type="button" onClick={() => openReply("reply")}><Reply size={18} aria-hidden="true" /><span>Responder</span></button>
                <button type="button" onClick={() => openReply("replyAll")}><ReplyAll size={18} aria-hidden="true" /><span>A todos</span></button>
                <button type="button" onClick={() => openReply("forward")}><Forward size={18} aria-hidden="true" /><span>Reenviar</span></button>
                {selected.thread.state === "inbox" ? <button type="button" disabled={busy || readOnlyPreview} onClick={() => act("archive", selected.thread.id)}><Archive size={18} aria-hidden="true" /><span>Archivar</span></button> : <button type="button" disabled={busy || readOnlyPreview} onClick={() => act("restore", selected.thread.id)}><Inbox size={18} aria-hidden="true" /><span>Restaurar</span></button>}
              </nav>
            </>
          ) : (
            <div className="grid h-full min-h-[28rem] place-items-center bg-gradient-to-br from-white to-blue-50/40 p-8 text-center">
              <div className="max-w-sm">
                <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-blue-50 text-blue-500 ring-8 ring-blue-50/50"><Mail size={34} aria-hidden="true" /></span>
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
          className="fixed inset-0 z-[80] flex h-[100dvh] items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mail-composer-title"
        >
          <button
            className="absolute inset-0"
            onClick={() => requestCloseComposer()}
            aria-label="Cerrar redacción"
            tabIndex={-1}
          />
          <form
            onSubmit={send}
            className="kc-mail-composer relative flex h-[100dvh] max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden overscroll-contain bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] text-slate-950 sm:py-3">
              <div className="flex min-w-0 items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Mail size={18} aria-hidden="true" /></span><h2 id="mail-composer-title" className="truncate font-display text-lg font-black">Nuevo mensaje</h2></div>
              <div className="flex items-center gap-2">
                {hasPermission(admin, "mail:manage_identities") ? <Link href="/admin/mail/configuracion" className="hidden min-h-10 items-center px-2 text-xs font-bold text-blue-700 hover:underline sm:inline-flex">Administrar identidades</Link> : null}
              <Tooltip label="Cerrar redacción" placement="bottom">
                <button
                  type="button"
                  onClick={() => requestCloseComposer()}
                  className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100"
                  aria-label="Cerrar redacción"
                  title="Cerrar redacción"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </Tooltip>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid min-w-0 gap-0">
                <label className="kc-mail-compose-field">
                  {!initial.identities.length ? <span role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">No tiene una dirección de Ken Code activa asignada. Comuníquese con el Owner para configurar una.{hasPermission(admin, "mail:manage_identities") ? <Link href="/admin/mail/configuracion" className="mt-2 block min-h-11 py-3 font-bold text-blue-700">Configurar direcciones</Link> : null}</span> : null}
                  <span className="kc-mail-compose-label">De</span>
                  <select
                    value={identityId}
                    onChange={(e) => {
                      setIdentityId(e.target.value);
                      setSelectedSignatureId("");
                      signatureApplied.current = false;
                    }}
                    required
                    className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm outline-none focus:ring-0"
                  >
                    <option value="">Seleccione una identidad</option>
                    {initial.identities.map((identity) => (
                      <option key={identity.id} value={identity.id}>
                        {identity.display_name} &lt;{identity.email}&gt;
                      </option>
                    ))}
                  </select>
                </label>
                <div className="kc-mail-compose-field">
                  <span className="kc-mail-compose-label">Para</span>
                  <input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    required
                    placeholder="Agregar destinatarios..."
                    autoFocus
                    aria-label="Destinatarios"
                    className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm font-normal outline-none focus:ring-0"
                  />
                  <button
                  type="button"
                  onClick={() => setShowCopies((value) => !value)}
                  className="min-h-10 shrink-0 px-2 text-xs font-bold text-blue-700"
                >
                  {showCopies ? "Ocultar" : "CC · BCC"}
                </button>
                </div>
                {showCopies ? (
                  <div className="grid border-b border-slate-200 sm:grid-cols-2">
                    <label className="kc-mail-compose-field border-b-0 sm:border-r">
                      <span className="kc-mail-compose-label">CC</span>
                      <input
                        value={cc}
                        onChange={(e) => setCc(e.target.value)}
                        className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm font-normal outline-none focus:ring-0"
                      />
                    </label>
                    <label className="kc-mail-compose-field border-b-0">
                      <span className="kc-mail-compose-label">BCC</span>
                      <input
                        value={bcc}
                        onChange={(e) => setBcc(e.target.value)}
                        className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm font-normal outline-none focus:ring-0"
                      />
                    </label>
                  </div>
                ) : null}
                <label className="kc-mail-compose-field">
                  <span className="kc-mail-compose-label">Asunto</span>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={998}
                    placeholder="Asunto del correo"
                    className="min-h-11 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm font-normal outline-none focus:ring-0"
                  />
                </label>
                {composerContextEntries.length ? <section className="border-b border-slate-200 bg-slate-50/60 px-4 py-3" aria-labelledby="compose-crm-context"><div className="flex flex-wrap items-center gap-2"><span id="compose-crm-context" className="mr-1 text-xs font-black text-slate-700">Relacionado con</span>{composerContextEntries.map((item) => { const content = <><span className="text-blue-500">{item.label}:</span><span className="truncate">{item.value}</span></>; const className = "inline-flex min-h-8 min-w-0 max-w-full items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2 text-xs font-bold text-blue-800"; return item.href ? <Link key={`${item.label}-${item.value}`} href={item.href} className={className}>{content}</Link> : <span key={`${item.label}-${item.value}`} className={className}>{content}</span>; })}</div></section> : null}
                <div className="grid gap-3 border-b border-slate-200 bg-slate-50/45 p-3 sm:grid-cols-2">
                {initial.templates.length ? (
                  <label className="grid gap-1 text-xs font-bold">
                    <span className="inline-flex items-center gap-1"><FileText size={14} aria-hidden="true" /> Plantilla</span>
                    <select
                      defaultValue=""
                      onChange={(e) => applyTemplate(e.target.value)}
                      className="min-h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm"
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
                      value={selectedSignatureId}
                      onChange={(e) => applySignature(e.target.value)}
                      className="min-h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="">Firma automática</option>
                      {initial.signatures.filter((signature) => !signature.identity_id || signature.identity_id === identityId).map((signature) => (
                        <option key={signature.id} value={signature.id}>
                          {signature.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                </div>
                {composeContext.proposalId && composeContext.addOnId ? (
                  <button
                    type="button"
                    disabled={busy || readOnlyPreview}
                    onClick={() => void attachProposalPdf()}
                    className="m-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-800"
                  >
                    <FileText size={16} /> Adjuntar PDF de propuesta
                  </button>
                ) : null}
                <div className="min-w-0 p-3"><RichTextEditor value={html} onChange={setHtml} label="Mensaje" required minHeightClassName="min-h-48 sm:min-h-56" /></div>
                {selectedSignatureId ? (() => { const signature = initial.signatures.find((item) => item.id === selectedSignatureId); return signature ? <section className="mx-3 mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><p className="border-b border-slate-200 px-3 py-2 text-xs font-bold text-kc-muted">Firma que se incluirá · {signature.source === "corporate" ? "Corporativa protegida" : "Personal"}</p><div className="kc-mail-signature-preview max-w-full overflow-x-auto p-3 text-sm" dangerouslySetInnerHTML={{ __html: signaturePreviewHtml(signature) }} /></section> : null; })() : null}
                {attachments.length ? (
                  <div className="grid gap-2 border-t border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2" aria-label="Archivos adjuntos">
                    {attachments.map((item) => (
                      <span key={item.id} className="flex min-h-12 min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-700"><FileText size={15} aria-hidden="true" /></span><span className="min-w-0 flex-1 truncate">{item.filename}</span><span className="shrink-0 font-normal text-kc-muted">{readableSize(item.size_bytes)}</span></span>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-center gap-2 px-4 pb-3 text-xs text-kc-muted">
                  <Check size={14} />{" "}
                  {readOnlyPreview
                    ? "Preview solo lectura · guardado y envío desactivados"
                    : draft.id
                    ? "Borrador guardado"
                    : "Guardado automático activo"}
                </div>
              </div>
            </div>
            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700">
                  <Paperclip size={16} /> Adjuntar archivos
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.txt"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void uploadAttachment(file);
                    }}
                    disabled={busy || readOnlyPreview}
                  />
                </label>
                {draft.id && !confirmDiscard ? (
                  <button
                    type="button"
                    disabled={busy || readOnlyPreview}
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
                      disabled={busy || readOnlyPreview}
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
                disabled={busy || sending || readOnlyPreview || !identityId}
                className="inline-flex min-h-11 min-w-32 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white shadow-sm hover:bg-blue-800 disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}{" "}
                {sending ? "Enviando…" : "Enviar"}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmPermanentDelete}
        title="Eliminar conversación definitivamente"
        description={deleteAssessment?.reason || "Comprobando si esta conversación puede eliminarse…"}
        confirmText="Eliminar definitivamente"
        variant="danger"
        loading={busy}
        confirmDisabled={deleteReason.trim().length < 3}
        onCancel={() => {
          setConfirmPermanentDelete(false);
          setDeleteAssessment(null);
          setDeleteReason("");
        }}
        onConfirm={() => {
          if (selected) void act("hard_delete", selected.thread.id);
        }}
      >
        <label className="block text-sm font-bold text-kc-text">
          Motivo de eliminación
          <textarea
            data-dialog-initial-focus
            value={deleteReason}
            onChange={(event) => setDeleteReason(event.target.value)}
            maxLength={500}
            rows={3}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-normal text-kc-text outline-none focus:border-kc-cyan"
            placeholder="Ejemplo: conversación de prueba sin historial comercial"
          />
        </label>
        {deleteAssessment?.attachmentCount ? (
          <p className="mt-2 text-xs text-kc-muted">
            Se eliminarán también {deleteAssessment.attachmentCount} adjunto(s) sin referencias activas.
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
