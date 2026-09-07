export function AdminRouteLoading({ label = "Cargando información" }: { label?: string }) {
  return (
    <div className="grid animate-pulse gap-5" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="h-8 w-56 max-w-3/4 rounded-lg bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => <div key={item} className="h-28 rounded-2xl border border-slate-200 bg-white" />)}
      </div>
      <div className="h-72 rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}
