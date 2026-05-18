import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CRM privado | Ken Code",
  description: "Panel privado de Ken Code para leads, tareas y notificaciones.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
