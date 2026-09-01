import { redirect } from "next/navigation";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { AdminLogin } from "@/components/admin/admin-login";
import { PaymentList } from "@/components/admin/payment-list";
import {
  getCurrentAdmin,
  getMissingAdminEnv,
  getMissingAuthClientEnv,
} from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/authorization";
import { getCrmAuthProvider } from "@/lib/auth/provider";
import { listPaymentsPage } from "@/lib/billing/data";
import { commercialPageContext } from "@/lib/commercial/page-context";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin)
    return (
      <AdminLogin
        authProvider={getCrmAuthProvider()}
        missingServerEnv={getMissingAdminEnv()}
        missingClientEnv={getMissingAuthClientEnv()}
      />
    );
  if (!hasPermission(admin, "billing:view")) redirect("/admin");
  const p = await searchParams;
  const value = (key: string) =>
    typeof p[key] === "string" ? (p[key] as string) : undefined;
  const [result, context] = await Promise.all([
    listPaymentsPage({
      page: Number(value("page") || 1),
      currency: "USD",
      status: value("status"),
    }),
    commercialPageContext(admin),
  ]);
  return (
    <AdminChrome
      admin={admin}
      unreadCount={context.unreadCount}
      authProvider={getCrmAuthProvider()}
    >
      <div className="grid gap-5">
        <div className="kc-page-header">
          <p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">
            Pagos
          </p>
          <h1 className="mt-1 font-display text-2xl font-black sm:text-3xl">
            Pagos recibidos
          </h1>
          <p className="mt-1 text-sm text-kc-muted">
            Dinero real recibido en USD, sus aplicaciones y reversiones con
            historial preservado.
          </p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p>
            <strong>
              Los pagos se registran a partir de un Cobro pendiente.
            </strong>{" "}
            Así el dinero recibido siempre queda aplicado a una obligación real.
          </p>
          <Link
            href="/admin/cobros"
            className="mt-2 inline-flex min-h-11 items-center font-black text-blue-700"
          >
            Ir a Cobros →
          </Link>
        </div>
        <PaymentList {...result} />
      </div>
    </AdminChrome>
  );
}
