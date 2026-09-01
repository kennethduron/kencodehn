export type AddOnCommercialStatus = "requested"|"quoting"|"proposal_sent"|"approved"|"rejected"|"cancelled";
export type AddOnWorkStatus = "pending"|"scheduled"|"in_progress"|"ready"|"delivered";
export type AddOnProposalStatus = "draft"|"sent"|"accepted"|"rejected"|"expired"|"superseded"|"cancelled";
export type AddOnPlanStatus = "draft"|"active"|"archived"|"cancelled";
export type AddOnRecurringStatus = "draft"|"active"|"paused"|"cancelled";

export type AddOnProposal = {
  id:string;addOnId:string;proposalNumber:string;version:number;status:AddOnProposalStatus;title:string;scope:string;amountMinor:string;currency:"USD";paymentTerms:string;monthlyAddOnMinor:string;estimatedDelivery:string;validUntil:string|null;clientNotes:string;internalNotes:string;createdBy:string;sentAt:string|null;decidedAt:string|null;decisionNotes:string;createdAt:string;
};
export type AddOnSale = {id:string;addOnId:string;proposalId:string;acceptedAmountMinor:string;currency:"USD";sellerId:string|null;effectiveDate:string;approvedAt:string};
export type AddOnInstallment = {id:string;paymentPlanId:string;sequence:number;label:string;amountMinor:string;currency:"USD";dueDate:string;dueTime:string|null;notes:string};
export type AddOnPaymentPlan = {id:string;saleId:string;version:number;name:string;status:AddOnPlanStatus;plannedTotalMinor:string;currency:"USD";activatedAt:string|null;installments:AddOnInstallment[]};
export type AddOnRecurring = {id:string;saleId:string;name:string;monthlyAmountMinor:string;currency:"USD";startDate:string;billingDay:number;billingTime:string;timezone:"America/Tegucigalpa";status:AddOnRecurringStatus};
export type ProjectAddOn = {
  id:string;projectId:string;projectName:string;clientId:string;clientName:string;name:string;description:string;requestDate:string;requestedByClient:boolean;commercialStatus:AddOnCommercialStatus;workStatus:AddOnWorkStatus;quotedAmountMinor:string|null;acceptedAmountMinor:string|null;currency:"USD";acceptedProposalId:string|null;sellerId:string|null;effectiveDate:string|null;plannedStartDate:string|null;targetDeliveryDate:string|null;actualDeliveryDate:string|null;approvedAt:string|null;rejectedAt:string|null;rejectionReason:string;cancelledAt:string|null;cancellationReason:string;archivedAt:string|null;archiveReason:string;deliveredAt:string|null;deliveryNotes:string;notes:string;createdAt:string;updatedAt:string;
  proposals:AddOnProposal[];sale:AddOnSale|null;paymentPlans:AddOnPaymentPlan[];recurring:AddOnRecurring|null;paidMinor:string;outstandingMinor:string;
};
export type AddOnListResult={items:ProjectAddOn[];total:number;page:number;pageSize:number};

export const commercialLabels:Record<AddOnCommercialStatus,string>={requested:"Solicitado",quoting:"En cotización",proposal_sent:"Propuesta enviada",approved:"Aprobado",rejected:"Rechazado",cancelled:"Cancelado"};
export const workLabels:Record<AddOnWorkStatus,string>={pending:"Pendiente",scheduled:"Programado",in_progress:"En desarrollo",ready:"Listo",delivered:"Entregado"};
export const proposalLabels:Record<AddOnProposalStatus,string>={draft:"Borrador",sent:"Enviada",accepted:"Aceptada",rejected:"Rechazada",expired:"Vencida",superseded:"Reemplazada",cancelled:"Cancelada"};
