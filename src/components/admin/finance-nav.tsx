import Link from "next/link";
import { BarChart3, FileText, Landmark, List, ReceiptText } from "lucide-react";

const items=[
  ["/admin/finanzas","Resumen",Landmark],
  ["/admin/finanzas/gastos","Gastos",ReceiptText],
  ["/admin/finanzas/movimientos","Movimientos",List],
  ["/admin/finanzas/reportes","Reportes",FileText],
] as const;

export function FinanceNav({active}:{active:"summary"|"expenses"|"movements"|"reports"}){
  const activeIndex={summary:0,expenses:1,movements:2,reports:3}[active];
  return <nav aria-label="Secciones de Finanzas" className="kc-scroll-tabs flex gap-1 overflow-x-auto rounded-2xl border bg-white p-1.5">{items.map(([href,label,Icon],index)=><Link key={href} href={href} aria-current={index===activeIndex?"page":undefined} className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black ${index===activeIndex?"bg-blue-600 text-white shadow-sm":"text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}><Icon size={17}/>{label}</Link>)}</nav>;
}

export function FinancePageHeader({title,description,action}:{title:string;description:string;action?:React.ReactNode}){
  return <div className="kc-page-header flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">Finanzas</p><h1 className="mt-1 font-display text-2xl font-black text-kc-text sm:text-3xl">{title}</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-kc-muted">{description}</p></div>{action}</div>;
}

export function FinanceEmptyState(){return <div className="kc-admin-card grid min-h-64 place-items-center p-7 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700"><BarChart3 size={24}/></span><h2 className="mt-4 text-xl font-black text-kc-text">Aun no hay movimientos financieros</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-kc-muted">El resumen se completara con proyectos vendidos, pagos reales y gastos registrados. No mostramos datos de ejemplo.</p></div></div>}
