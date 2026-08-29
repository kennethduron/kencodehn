import type { Metadata } from "next";
import { OwnerEmailVerificationForm } from "@/components/auth/owner-email-verification-form";

export const metadata: Metadata = {
  title: "Verifique su correo | Ken Code",
  description: "Verificación segura del correo del Owner de Ken Code.",
  robots: { index: false, follow: false, nocache: true },
};

export default function VerifyOwnerEmailPage() {
  return <OwnerEmailVerificationForm />;
}
