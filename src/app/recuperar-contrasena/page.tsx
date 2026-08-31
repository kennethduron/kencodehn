import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getCrmAuthProvider } from "@/lib/auth/provider";

export default function PasswordRecoveryRequestPage() {
  if (getCrmAuthProvider() !== "supabase") redirect("/admin");
  return (
    <AuthShell
      title="Recuperar contraseña"
      description="Ingrese su correo para recibir instrucciones seguras. Por privacidad, la respuesta no confirma si existe una cuenta asociada."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
