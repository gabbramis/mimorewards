"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  PlusCircle,
  QrCode,
  Store,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/negocios", label: "Negocios", icon: Store },
  { href: "/admin/crear-comercio", label: "Crear Comercio", icon: PlusCircle },
  { href: "/admin/contactos", label: "Clientes", icon: Users },
  { href: "/admin/comunicaciones", label: "Comunicaciones", icon: Megaphone },
  { href: "/admin/accesos", label: "Accesos", icon: KeyRound },
  { href: "/admin/caja", label: "QR de Caja", icon: QrCode },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="m-admin-shell flex flex-col md:flex-row h-dvh w-full overflow-hidden">
      {/* Top Navbar visible solo en móvil (< md) */}
      <header className="flex md:hidden items-center justify-between border-b border-[#D5CFC4] bg-[#FFFAF5] px-4 py-3 shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D5CFC4] bg-white text-[#1F1F1F] hover:bg-[#FFF0F1] hover:text-[#FF1F2D] transition-colors"
            aria-label="Abrir menú de navegación"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo-mimo.png" alt="mimo" className="h-7 w-auto object-contain" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9A8D84] truncate">
              Panel de Comercios
            </span>
          </div>
        </div>
      </header>

      {/* Backdrop del Drawer en móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar fijo en escritorio (md:) y Drawer lateral en móvil (< md) */}
      <aside
        aria-label="Navegación del panel"
        className={`m-admin-sidebar fixed inset-y-0 left-0 z-50 flex w-[260px] max-w-[85vw] flex-col justify-between border-r border-[#D5CFC4] bg-[#FFFAF5] transition-transform duration-200 ease-in-out md:static md:w-[258px] md:shrink-0 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="m-admin-brand-row flex items-center justify-between">
            <div className="m-admin-brand">
              <img src="/logo-mimo.png" alt="mimo" />
              <span>Panel de Comercios</span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex md:hidden h-9 w-9 items-center justify-center rounded-xl bg-[#FFF0F1] text-[#1F1F1F] hover:bg-[#FFD9DC] transition-colors"
              aria-label="Cerrar menú"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="m-admin-nav space-y-1.5 px-4">
            <p className="m-admin-nav-label">GESTIÓN</p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`m-admin-nav-link flex items-center rounded-xl px-3.5 py-2.5 transition-all ${
                    active ? "is-active" : ""
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2.3 : 1.9} />
                  <span>{item.label}</span>
                  <ChevronRight size={14} className="m-admin-nav-arrow" />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="m-admin-account p-4 space-y-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="m-admin-avatar flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white">
              SA
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">Super Admin</p>
              <p className="truncate text-[11px] font-semibold">Acceso total</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#e7d8cd] bg-white px-3 py-2 text-xs font-bold text-[#796f69] transition hover:border-[#ff1f2d] hover:bg-[#fff0f1] hover:text-[#ff1f2d] disabled:opacity-50"
          >
            <LogOut size={15} />
            <span>{loggingOut ? "Cerrando..." : "Cerrar sesión"}</span>
          </button>
        </div>
      </aside>

      {/* Contenedor Principal (<main>) con padding adaptativo p-4 md:p-8 y ancho fluido w-full max-w-7xl mx-auto */}
      <main className="m-admin-main min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">
        <div className="w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
