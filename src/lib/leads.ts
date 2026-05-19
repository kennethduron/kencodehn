import type { Locale } from "@/lib/site";

export type PublicLeadInput = {
  name: string;
  business: string;
  email: string;
  phone: string;
  project: string;
  budget?: string | null;
  message: string;
  locale: Locale;
  sourcePath: string;
};

export type LeadRecord = PublicLeadInput & {
  status: "new";
  priority: "medium";
  source: "public_website";
  estimatedValue: 0;
  wonValue: 0;
  lastContactAt: null;
  nextAction: "";
  followUpAt: null;
  tags: string[];
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
    budget: input.budget || "Por definir",
    status: "new",
    priority: "medium",
    source: "public_website",
    estimatedValue: 0,
    wonValue: 0,
    lastContactAt: null,
    nextAction: "",
    followUpAt: null,
    tags: [input.locale, input.project].filter(Boolean),
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
