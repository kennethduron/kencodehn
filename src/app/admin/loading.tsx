import { AdminDashboardSkeleton } from "@/components/admin/skeletons";

export default function AdminLoading() {
  return (
    <main className="kc-admin-theme min-h-screen bg-kc-bg px-4 py-6 text-kc-text sm:px-6 lg:px-8">
      <AdminDashboardSkeleton />
    </main>
  );
}
