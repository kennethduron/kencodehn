"use client";

import { Ban, Loader2, WalletCards } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BillingReceivable } from "@/lib/billing/types";
import { ConfirmDialog, Toast } from "./ui";

export function ReceivableActions({
  item,
  canCorrect,
  canRegisterPayment,
}: {
  item: BillingReceivable;
  canCorrect: boolean;
  canRegisterPayment: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const hasPayment = BigInt(item.amountPaidMinor) > BigInt(0);
  const cancellable = canCorrect && item.paymentState === "open" && !hasPayment;
  const recurring = item.originType === "recurring_service" || item.originType === "add_on_recurring";

  async function cancel() {
    if (busy || reason.trim().length < 3) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/billing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operation: "receivable_cancel", payload: { id: item.id, reason: reason.trim() } }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "No se pudo cancelar el cobro.");
      setConfirming(false);
      setReason("");
      setMessage(recurring ? "Periodo cancelado. No volverá a generarse." : "Cobro cancelado; el historial se conservó.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cancelar el cobro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="kc-admin-card p-5" aria-labelledby="receivable-actions-title">
      {message ? <Toast message={message} variant={message.startsWith("No") ? "error" : "success"} /> : null}
      <h2 id="receivable-actions-title" className="text-xl font-black">Acciones</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {canRegisterPayment && item.paymentState !== "paid" && item.paymentState !== "cancelled" ? (
          <Link href={`/admin/cobros?projectId=${item.projectId}&pay=1`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-kc-electric px-4 text-sm font-black text-white">
            <WalletCards size={17} /> Registrar pago
          </Link>
        ) : null}
        {cancellable ? (
          <button type="button" onClick={() => setConfirming(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-black text-rose-700 hover:bg-rose-50">
            <Ban size={17} /> {recurring ? "Cancelar este período" : "Cancelar cobro"}
          </button>
        ) : null}
      </div>
      {item.paymentState === "partially_paid" ? <p className="mt-4 text-sm text-kc-muted">No puede cancelarse porque ya tiene un pago aplicado. Si fue un error, un Owner o Admin debe revertir primero el pago.</p> : null}
      {item.paymentState === "paid" ? <p className="mt-4 text-sm text-kc-muted">Este cobro está pagado y su historial financiero está protegido.</p> : null}
      {item.paymentState === "cancelled" ? <p className="mt-4 text-sm text-kc-muted">Cobro cancelado. Motivo: {item.cancellationReason || "Registrado en el historial"}.</p> : null}
      {!canCorrect && item.paymentState === "open" ? <p className="mt-4 text-sm text-kc-muted">No tiene permiso para cancelar obligaciones financieras.</p> : null}
      <ConfirmDialog
        open={confirming}
        title={recurring ? `Cancelar período “${item.description}”` : `Cancelar cobro “${item.description}”`}
        description={recurring ? "El cliente dejará de deber este período. El servicio continuará con los períodos siguientes y este período no volverá a generarse." : "El cobro dejará de formar parte del saldo pendiente. Su registro permanecerá en el historial."}
        confirmText={recurring ? "Cancelar este período" : "Cancelar cobro"}
        variant="danger"
        loading={busy}
        onCancel={() => { if (!busy) { setConfirming(false); setReason(""); } }}
        onConfirm={cancel}
      >
        <label className="grid gap-2 text-sm font-bold">
          Motivo
          <textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={1000} className="rounded-xl border p-3" placeholder="Explique brevemente el motivo" />
        </label>
        {busy ? <p className="mt-2 inline-flex items-center gap-2 text-sm text-kc-muted"><Loader2 className="animate-spin" size={15} /> Guardando corrección…</p> : null}
      </ConfirmDialog>
    </section>
  );
}
