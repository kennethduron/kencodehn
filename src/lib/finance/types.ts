export type ExpenseStatus = "posted" | "reversed";
export type FinanceCurrency = "USD";
export type FinancePeriod = "month" | "last_month" | "quarter" | "year" | "custom";
export type FinanceReportType = "collections" | "receivables" | "overdue" | "expenses" | "cash_result" | "project_sales" | "seller";

export type ExpenseCategory = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  sortOrder: number;
};

export type Expense = {
  id: string;
  categoryId: string;
  categoryName: string;
  description: string;
  vendor: string;
  amountMinor: string;
  currency: string;
  expenseDate: string;
  paidAt: string | null;
  paymentMethod: string;
  reference: string;
  notes: string;
  projectId: string | null;
  projectName: string;
  status: ExpenseStatus;
  createdBy: string;
  createdAt: string;
  reversedAt: string | null;
  reversalReason: string;
};

export type FinanceSummary = {
  currency: string;
  soldMinor: string;
  collectedMinor: string;
  outstandingMinor: string;
  overdueMinor: string;
  recurringCollectedMinor: string;
  expenseMinor: string;
  netCashMinor: string;
};

export type FinanceSeriesPoint = { monthStart: string; collectedMinor: string; expenseMinor: string };

export type FinanceReportRow = {
  occurredOn: string;
  recordType: string;
  party: string;
  concept: string;
  projectName: string;
  paymentMethod: string;
  amountMinor: string;
  currency: string;
  status: string;
  sellerId: string | null;
  recordId: string;
};
