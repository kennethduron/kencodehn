export type ReceivableState = "open" | "partially_paid" | "paid" | "cancelled";
export type ReceivableOrigin = "project_installment" | "recurring_service" | "add_on_installment" | "add_on_recurring";
export type ReceivableTiming = "upcoming" | "due_today" | "overdue" | "settled";

export type BillingReceivable = {
  id: string; clientId: string; clientName: string; projectId: string; projectName: string;
  sellerId: string | null; originType: ReceivableOrigin; description: string;
  amountDueMinor: string; amountPaidMinor: string; balanceMinor: string; currency: string;
  dueDate: string; dueTime: string | null; dueAt: string | null; paymentState: ReceivableState;
  timingState: ReceivableTiming; notificationsEnabled: boolean;
  recurringServiceId: string | null; addOnRecurringServiceId: string | null;
  recurringPeriodKey: string | null; cancellationReason: string;
};

export type BillingPayment = {
  id: string; clientId: string; clientName: string; amountMinor: string; currency: string;
  paidAt: string; method: "bank_transfer" | "cash" | "card" | "paypal" | "other";
  reference: string; notes: string; status: "posted" | "reversed"; recordedBy: string;
  reversedAt: string | null; reversalReason: string;
  allocations: Array<{ id: string; receivableId: string; amountMinor: string; description: string; reversedAt: string | null }>;
};

export type ProjectBillingSummary = {
  projectId: string; totalMinor: string; paidMinor: string; outstandingMinor: string; currency: string;
};

export type BillingRule = { id: string; name: string; eventType: string; offsetDays: number; direction: string; sendTime: string; dueTimeOnly: boolean; enabled: boolean };
