import type { ReactNode } from "react";
import "@/components/customer/customer-experience.css";

export const metadata = {
  title: "Registro de Clientes | mimo rewards",
  description: "Sumate al programa de beneficios de tu comercio favorito.",
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 h-[100dvh] w-[100vw] overflow-hidden overscroll-none touch-none bg-[#f7f4ef] flex items-center justify-center">
      {children}
    </div>
  );
}
