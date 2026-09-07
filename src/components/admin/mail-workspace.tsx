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
  mail_messages?: Array<{
    direction: string;
    delivery_status?: Message["delivery_status"];
    from_address: { email?: string };
    to_addresses: Array<{ email?: string }>;
    sent_at?: string | null;
    created_at: string;
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
  failed: "Error",
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
    const isCompletelyEmpty = !isMeaningfulDraft(currentAutosaveEntry().payload);
    if (isCompletelyEmpty) return finishClosingComposer();
    const entry = currentAutosaveEntry();
    if (entry.fingerprint === lastSavedFingerprint.current) return finishClosingComposer();
    closeAfterAutosave.current = true;
    void persistAutosave(entry);
  }

  useEffect(() => {
    if (!compose) return;
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
    selectedSignatureId,
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
    if (action === "hard_delete") {
      setConfirmPermanentDelete(false);
      setNotice("Conversación eliminada definitivamente.");
      router.push(folderHref("trash"));
      router.refresh();
      return;
    }
    router.refresh();
  }
  async function send(event: FormEvent) {
    event.preventDefault();
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
    if (!selected?.thread.id) return;
    fetch("/api/admin/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "read", threadId: selected.thread.id }) }).catch(() => undefined);
  }, [selected?.thread.id]);

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
    selectedSignatureId,
    subject,
    to,
  ]);
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
          <Tooltip label="Configuración">
            <Link
              href="/admin/mail/configuracion"
              className="grid h-11 w-11 place-items-center rounded-xl border bg-white"
              aria-label="Configuración de Mail"
              title="Configuración de Mail"
            >
              <Settings size={19} aria-hidden="true" />
            </Link>
          </Tooltip>
          <button
            type="button"
            onClick={(event) => { composeTrigger.current = event.currentTarget; closeAfterAutosave.current = false; setCompose(true); }}
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
                        {initial.folder === "sent"
                          ? `Para: ${latestOutbound(thread)?.to_addresses
                              .map((address) => address.email)
                              .filter(Boolean)
                              .join(", ") || "Sin destinatario"}`
                          : identityOf(thread)?.email || "Ken Code"}
                      </span>
                      <time className="shrink-0 text-[.68rem] text-kc-muted">
                        {new Date(
                          initial.folder === "sent"
                            ? thread.last_outbound_at ||
                                latestOutbound(thread)?.sent_at ||
                                latestOutbound(thread)?.created_at ||
                                thread.latest_message_at
                            : thread.latest_message_at,
                        ).toLocaleString("es-HN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
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
                      {initial.folder === "sent" &&
                      latestOutbound(thread)?.delivery_status ? (
                        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[.65rem] font-black text-slate-700">
                          {
                            deliveryLabels[
                              latestOutbound(thread)!
                                .delivery_status as Message["delivery_status"]
                            ]
                          }
                        </span>
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
                    aria-label="Volver a conversaciones"
                  >
                    <ArrowLeft size={18} aria-hidden="true" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-display text-lg font-black">
                      {selected.thread.subject}
                    </h2>
                    <p className="mt-1 truncate text-xs text-kc-muted">
                      {identityOf(selected.thread)?.email}
                    </p>
                  </div>
                  <Tooltip label={selected.thread.is_important ? "Quitar importante" : "Marcar como importante"} placement="bottom">
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
                      aria-label={selected.thread.is_important ? "Quitar importante" : "Marcar como importante"}
                      title={selected.thread.is_important ? "Quitar importante" : "Marcar como importante"}
                    >
                      <Star size={17} aria-hidden="true" />
                    </button>
                  </Tooltip>
                  <Tooltip label="Marcar como no leído" placement="bottom">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act("unread", selected.thread.id)}
                      className="grid h-10 w-10 place-items-center rounded-xl border"
                      aria-label="Marcar como no leído"
                      title="Marcar como no leído"
                    >
                      <MailOpen size={17} aria-hidden="true" />
                    </button>
                  </Tooltip>
                  {selected.thread.state !== "inbox" ? (
                    <Tooltip label="Restaurar" placement="bottom">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act("restore", selected.thread.id)}
                        className="grid h-10 w-10 place-items-center rounded-xl border"
                        aria-label="Restaurar"
                        title="Restaurar"
                      >
                        <Inbox size={17} aria-hidden="true" />
                      </button>
                    </Tooltip>
                  ) : (
                    <Tooltip label="Archivar" placement="bottom">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act("archive", selected.thread.id)}
                        className="grid h-10 w-10 place-items-center rounded-xl border"
                        aria-label="Archivar"
                        title="Archivar"
                      >
                        <Archive size={17} aria-hidden="true" />
                      </button>
                    </Tooltip>
                  )}
                  {selected.thread.state !== "trash" ? (
                    <Tooltip label="Mover a Papelera" placement="bottom">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act("trash", selected.thread.id)}
                        className="grid h-10 w-10 place-items-center rounded-xl border text-rose-700"
                        aria-label="Mover a Papelera"
                        title="Mover a Papelera"
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </Tooltip>
                  ) : admin.role === "owner" ? (
                    <Tooltip label="Eliminar definitivamente" placement="bottom">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmPermanentDelete(true)}
                        className="grid h-10 w-10 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700"
                        aria-label="Eliminar definitivamente"
                        title="Eliminar definitivamente"
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </Tooltip>
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
                    {message.attachments?.length ? <div className="mt-4 grid gap-2 border-t border-slate-100 pt-3" aria-label="Adjuntos del mensaje">
                      {message.attachments.map((attachment) => <a key={attachment.id} href={`/api/admin/mail/attachments?id=${encodeURIComponent(attachment.id)}`} className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-blue-800 hover:border-blue-300" download>
                        <Paperclip size={16} className="shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1 break-all">{attachment.filename}</span><span className="shrink-0 text-xs font-normal text-kc-muted">{attachment.content_type.split("/").at(-1)?.toUpperCase()} · {Math.ceil(attachment.size_bytes / 1024)} KB</span>
                      </a>)}
                    </div> : null}
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
          className="fixed inset-0 z-[80] flex h-[100dvh] items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Redactar correo"
        >
          <button
            className="absolute inset-0"
            onClick={() => requestCloseComposer()}
            aria-label="Cerrar redacción"
          />
          <form
            onSubmit={send}
            className="kc-mail-composer relative flex h-[100dvh] max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden overscroll-contain bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
          >
            <header className="flex shrink-0 items-center justify-between bg-slate-900 px-4 pb-3 pt-[max(.75rem,env(safe-area-inset-top))] text-white sm:py-3">
              <strong>Nuevo mensaje</strong>
              <Tooltip label="Cerrar redacción" placement="bottom">
                <button
                  type="button"
                  onClick={() => requestCloseComposer()}
                  className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10"
                  aria-label="Cerrar redacción"
                  title="Cerrar redacción"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </Tooltip>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid gap-3">
                <label className="grid gap-1 text-xs font-bold">
                  {!initial.identities.length ? <span role="status" className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">No tiene una dirección de Ken Code activa asignada. Comuníquese con el Owner para configurar una.{hasPermission(admin, "mail:manage_identities") ? <Link href="/admin/mail/configuracion" className="mt-2 block min-h-11 py-3 font-bold text-blue-700">Configurar direcciones</Link> : null}</span> : null}
                  De
                  <select
                    value={identityId}
                    onChange={(e) => {
                      setIdentityId(e.target.value);
                      setSelectedSignatureId("");
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
                      value={selectedSignatureId}
                      onChange={(e) => applySignature(e.target.value)}
                      className="min-h-11 rounded-xl border px-3 text-sm"
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
                {selectedSignatureId ? (() => { const signature = initial.signatures.find((item) => item.id === selectedSignatureId); return signature ? <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><p className="border-b border-slate-200 px-3 py-2 text-xs font-bold text-kc-muted">Vista previa de la firma · {signature.source === "corporate" ? "Corporativa protegida" : "Personal"}</p><div className="max-w-full overflow-x-auto p-3 text-sm" dangerouslySetInnerHTML={{ __html: signaturePreviewHtml(signature) }} /></section> : null; })() : null}
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
                <RichTextEditor value={html} onChange={setHtml} label="Mensaje" required />
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
            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
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
                disabled={busy || sending || !identityId}
                className="inline-flex min-h-11 min-w-28 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-black text-white disabled:opacity-60"
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
        description="Esta conversación se eliminará de Ken Code Mail y no podrá recuperarse. Las conversaciones vinculadas a actividad comercial, seguimientos o adjuntos protegidos no pueden eliminarse."
        confirmText="Eliminar definitivamente"
        variant="danger"
        loading={busy}
        onCancel={() => setConfirmPermanentDelete(false)}
        onConfirm={() => {
          if (selected) void act("hard_delete", selected.thread.id);
        }}
      />
    </div>
  );
}
