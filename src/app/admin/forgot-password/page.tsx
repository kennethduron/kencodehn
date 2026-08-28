import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getCrmAuthProvider } from "@/lib/auth/provider";

export default function ForgotPasswordPage() {
  if (getCrmAuthProvider() !== "supabase") redirect("/admin");
  return <AuthShell title="Recuperar acceso" description="Solicite un enlace seguro. Por privacidad, la respuesta no confirma si el correo está registrado."><ForgotPasswordForm /></AuthShell>;
}
