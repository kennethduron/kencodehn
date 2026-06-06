"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/site/footer";
import { FloatingContact } from "@/components/site/floating-contact";
import { Header } from "@/components/site/header";
import { KenAiChat } from "@/components/site/kencode-ai-chat";

export function PublicShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      {children}
      <Footer />
      <KenAiChat />
      <FloatingContact />
    </>
  );
}
