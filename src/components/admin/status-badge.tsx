import type { LeadPriority, LeadStatus, TaskPriority, TaskStatus } from "@/lib/admin/types";
import { leadPriorityLabels, leadStatusLabels, taskPriorityLabels, taskStatusLabels } from "./admin-labels";

const statusClass: Record<LeadStatus | TaskStatus, string> = {
  new: "border-kc-cyan/35 bg-kc-cyan/10 text-kc-cyan",
  contacted: "border-blue-300/35 bg-blue-300/10 text-blue-200",
  conversation: "border-kc-turquoise/35 bg-kc-turquoise/10 text-kc-turquoise",
  quoted: "border-kc-lime/35 bg-kc-lime/10 text-kc-lime",
  won: "border-emerald-300/35 bg-emerald-300/10 text-emerald-200",
  lost: "border-rose-300/35 bg-rose-300/10 text-rose-200",
  pending: "border-kc-cyan/35 bg-kc-cyan/10 text-kc-cyan",
  in_progress: "border-kc-turquoise/35 bg-kc-turquoise/10 text-kc-turquoise",
  completed: "border-emerald-300/35 bg-emerald-300/10 text-emerald-200",
  overdue: "border-rose-300/35 bg-rose-300/10 text-rose-200",
};

const priorityClass: Record<LeadPriority | TaskPriority, string> = {
  low: "border-slate-300/25 bg-slate-300/10 text-slate-200",
  medium: "border-kc-cyan/35 bg-kc-cyan/10 text-kc-cyan",
  high: "border-kc-lime/40 bg-kc-lime/10 text-kc-lime",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass[status]}`}>{leadStatusLabels[status]}</span>;
}

export function LeadPriorityBadge({ priority }: { priority: LeadPriority }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${priorityClass[priority]}`}>{leadPriorityLabels[priority]}</span>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass[status]}`}>{taskStatusLabels[status]}</span>;
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${priorityClass[priority]}`}>{taskPriorityLabels[priority]}</span>;
}
