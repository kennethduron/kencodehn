export type DraftAutosavePayload = {
  identityId: string | null;
  signatureId: string | null;
  threadId: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  html: string;
  context: {
    leadId: string | null;
    clientId: string | null;
    projectId: string | null;
    addOnId: string | null;
    proposalId: string | null;
  };
};

export function draftFingerprint(payload: DraftAutosavePayload) {
  return JSON.stringify(payload);
}

export function isMeaningfulDraft(payload: DraftAutosavePayload) {
  return Boolean(
    payload.to.length || payload.cc.length || payload.bcc.length || payload.subject || payload.html
    || payload.threadId || payload.context.leadId || payload.context.clientId || payload.context.projectId
    || payload.context.addOnId || payload.context.proposalId,
  );
}
