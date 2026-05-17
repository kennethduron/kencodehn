import type { Locale } from "@/lib/site";

export type PublicLeadInput = {
  name: string;
  business: string;
  email: string;
  phone: string;
  project: string;
  budget: string;
  message: string;
  locale: Locale;
  sourcePath: string;
};

export type LeadRecord = PublicLeadInput & {
  status: "new";
  priority: "normal";
  source: "public_website";
  createdAt: string;
  updatedAt: string;
  crm: {
    ready: true;
    assignedTo: null;
    notes: string[];
    tags: string[];
  };
  notification: {
    internalStatus: "pending_configuration";
    channels: string[];
    message: string;
  };
  metadata: {
    userAgent: string;
    referer: string;
    ip: string;
  };
};

export function createLeadRecord(input: PublicLeadInput, metadata: LeadRecord["metadata"]): LeadRecord {
  const now = new Date().toISOString();

  return {
    ...input,
    status: "new",
    priority: "normal",
    source: "public_website",
    createdAt: now,
    updatedAt: now,
    crm: {
      ready: true,
      assignedTo: null,
      notes: [],
      tags: [input.locale, input.project].filter(Boolean),
    },
    notification: {
      internalStatus: "pending_configuration",
      channels: ["crm", "email"],
      message: `Nuevo lead publico de ${input.name} para ${input.project}.`,
    },
    metadata,
  };
}
