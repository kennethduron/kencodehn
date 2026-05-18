function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`kc-skeleton rounded-xl ${className}`} />;
}

export function AdminDashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-3">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-10 w-72 max-w-full" />
        </div>
        <SkeletonBlock className="h-11 w-36" />
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="kc-admin-card min-h-36 p-5">
            <div className="flex justify-between gap-4">
              <div className="grid flex-1 gap-4">
                <SkeletonBlock className="h-4 w-24" />
                <SkeletonBlock className="h-9 w-20" />
              </div>
              <SkeletonBlock className="h-11 w-11" />
            </div>
            <SkeletonBlock className="mt-5 h-3 w-32" />
          </div>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <SkeletonBlock className="h-80" />
        <SkeletonBlock className="h-80" />
      </section>
    </div>
  );
}
