export type ClientStatus = "active" | "inactive";
export type ProjectStatus = "draft" | "planning" | "active" | "on_hold" | "completed" | "cancelled";
export type PaymentPlanStatus = "draft" | "active" | "archived";
export type RecurringFrequency = "monthly" | "quarterly" | "yearly";
export type RecurringServiceStatus = "draft" | "active" | "paused" | "cancelled";

export type CommercialClient = {
  id: string;
  clientNumber: string;
  kind: "individual" | "company";
  originLeadId: string | null;
  name: string;
  company: string;
  email: string;
  phone: string;
  whatsapp: string;
  country: string;
  region: string;
  city: string;
  address: string;
  status: ClientStatus;
  clientSince: string;
  notes: string;
  tags: string[];
  assignedToUid: string | null;
  assignedAt: string | null;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
};

export type CommercialProject = {
  id: string;
  clientId: string;
  clientName?: string;
  name: string;
  description: string;
  status: ProjectStatus;
  totalAmountMinor: number;
  currency: string;
  soldAt: string | null;
  effectiveDate: string;
  startDate: string | null;
  targetEndDate: string | null;
  completedAt: string | null;
  assignedToUid: string | null;
  assignedAt: string | null;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectInstallment = {
  id: string;
  paymentPlanId: string;
  sequence: number;
  label: string;
  amountMinor: number;
  currency: string;
  dueDate: string | null;
  dueTime: string | null;
  notes: string;
};

export type ProjectPaymentPlan = {
  id: string;
  projectId: string;
  version: number;
  name: string;
  status: PaymentPlanStatus;
  plannedTotalMinor: number;
  currency: string;
  activatedAt: string | null;
  createdAt: string;
  installments: ProjectInstallment[];
};

export type ProjectRecurringService = {
  id: string;
  projectId: string;
  name: string;
  monthlyAmountMinor: number;
  currency: string;
  frequency: RecurringFrequency;
  startDate: string;
  billingDay: number;
  billingTime: string;
  timezone: string;
  status: RecurringServiceStatus;
};

export type CommercialActivity = {
  id: string;
  entityType: string;
  action: string;
  title: string;
  description: string;
  actorId: string | null;
  actorEmail: string;
  createdAt: string;
};

export type SellerAssignmentEvent = {
  id: string;
  entityType: "client" | "project";
  previousSellerId: string | null;
  newSellerId: string | null;
  actorId: string;
  actorEmail: string;
  reason: string;
  createdAt: string;
};
