import { notFound, redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { ReceivableActions } from "@/components/admin/receivable-actions";
import { hasPermission } from "@/lib/admin/authorization";
import { getCurrentAdmin, getMissingAdminEnv, getMissingAuthClientEnv } from "@/lib/admin/auth";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { getReceivable } from "@/lib/billing/data";
import { formatMinor } from "@/lib/billing/money";
import { commercialPageContext } from "@/lib/commercial/page-context";

export const dynamic = "force-dynamic";

const paymentLabels = { open: "Abierto", partially_paid: "Pago parcial", paid: "Pagado", cancelled: "Cancelado" } as const;
const timingLabels = { upcoming: "Próximo", due_today: "Vence hoy", overdue: "Vencido", settled: "Cerrado" } as const;
const originLabels = { project_installment: "Cuota de proyecto", recurring_service: "Mensualidad", add_on_installment: "Cuota de módulo", add_on_recurring: "Mensualidad de módulo" } as const;

export default async function ReceivablePage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) return <AdminLogin authProvider={getCrmAuthProvider()} missingServerEnv={getMissingAdminEnv()} missingClientEnv={getMissingAuthClientEnv()} />;
  if (!hasPermission(admin, "billing:view")) redirect("/admin");
  const { id } = await params;
  const [item, context] = await Promise.all([getReceivable(id), commercialPageContext(admin)]);
  if (!item) notFound();
  return (
    <AdminChrome admin={admin} unreadCount={context.unreadCount} authProvider={getCrmAuthProvider()}>
      <div className="grid gap-5">
        <a href="/admin/cobros" className="inline-flex min-h-11 items-center font-black text-kc-electric">← Volver a Cobros</a>
        <div>
          <p className="text-sm font-black uppercase tracking-[.18em] text-kc-cyan">Cobro</p>
          <h1 className="mt-2 text-3xl font-black">{item.description}</h1>
          <p className="mt-2 text-kc-muted">{item.clientName} · {item.projectName}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[["Importe", formatMinor(item.amountDueMinor, item.currency)], ["Pagado", formatMinor(item.amountPaidMinor, item.currency)], ["Pendiente", formatMinor(item.balanceMinor, item.currency)], ["Vencimiento", `${item.dueDate}${item.dueTime ? ` · ${item.dueTime}` : ""}`]].map(([label, value]) => (
            <article key={label} className="kc-admin-card p-5"><p className="text-xs font-black uppercase tracking-[.14em] text-kc-muted">{label}</p><p className="mt-2 text-xl font-black">{value}</p></article>
          ))}
        </div>
        <article className="kc-admin-card p-5">
          <h2 className="text-xl font-black">Estado financiero</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-kc-muted">Pago</dt><dd className="font-black">{paymentLabels[item.paymentState]}</dd></div>
            <div><dt className="text-kc-muted">Vencimiento</dt><dd className="font-black">{timingLabels[item.timingState]}</dd></div>
            <div><dt className="text-kc-muted">Origen</dt><dd className="font-black">{originLabels[item.originType]}</dd></div>
          </dl>
          <p className="mt-3 text-sm text-kc-muted">Los importes se derivan de pagos aplicados y no pueden editarse manualmente.</p>
        </article>
        <ReceivableActions item={item} canCorrect={hasPermission(admin, "billing:correct_future")} canRegisterPayment={hasPermission(admin, "payments:manage")} />
      </div>
    </AdminChrome>
  );
}
