import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { RecoveryForm } from "@/components/auth/recovery-form";
import { getCrmAuthProvider } from "@/lib/auth/provider";

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  if (getCrmAuthProvider() !== "supabase") redirect("/admin");
  const params = await searchParams;
  const invitation = params.mode === "invite";
  return <AuthShell title={invitation ? "Configurar cuenta" : "Crear nueva contraseña"} description="El enlace es temporal y solo puede utilizarse dentro de su flujo seguro."><RecoveryForm invitation={invitation} /></AuthShell>;
}
