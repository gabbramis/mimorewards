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
    <div className="m-admin-shell flex flex-col md:flex-row h-dvh w-full overflow-hidden bg-black text-white font-sans antialiased">
      {/* Top Navbar visible solo en móvil (< md) */}
      <header className="flex md:hidden h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            aria-label="Abrir menú de navegación"
          >
            <Menu size={20} />
          </button>
          <Link
            href="/admin"
            className="flex items-center gap-2.5 min-w-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/mimo-wordmark.png"
              alt="mimo rewards"
              className="h-7 w-auto object-contain shrink-0 block brightness-0 invert"
            />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 truncate leading-none">
              Panel de Comercios
            </span>
          </Link>
        </div>
      </header>

      {/* Backdrop del Drawer en móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs transition-opacity md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar fijo en escritorio (md:) y Drawer lateral en móvil (< md) */}
      <aside
        aria-label="Navegación del panel"
        className={`m-admin-sidebar fixed inset-y-0 left-0 z-50 flex w-[260px] max-w-[85vw] flex-col justify-between border-r border-zinc-800 bg-zinc-950 transition-transform duration-200 ease-in-out md:static md:w-[258px] md:shrink-0 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="flex h-16 md:h-20 items-center justify-between border-b border-zinc-800 px-5 shrink-0">
            <Link
              href="/admin"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 min-w-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/mimo-wordmark.png"
                alt="mimo rewards"
                className="h-8 w-auto object-contain shrink-0 block brightness-0 invert"
              />
              <span className="rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 truncate leading-none">
                Admin
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="flex md:hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
              aria-label="Cerrar menú"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="space-y-1 px-3 py-5">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              GESTIÓN
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-zinc-900 text-white font-semibold border border-zinc-800"
                      : "text-zinc-400 hover:bg-zinc-900/60 hover:text-white border border-transparent"
                  }`}
                >
                  <Icon
                    size={17}
                    strokeWidth={active ? 2.2 : 1.8}
                    className={active ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"}
                  />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight
                    size={14}
                    className={`transition-opacity ${
                      active ? "opacity-80 text-zinc-400" : "opacity-0 group-hover:opacity-60 text-zinc-500"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-zinc-800 p-4 space-y-2.5">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs font-semibold text-white">
              SA
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">Super Admin</p>
              <p className="truncate text-[11px] font-medium text-zinc-400">Acceso total</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white disabled:opacity-50"
          >
            <LogOut size={15} />
            <span>{loggingOut ? "Cerrando..." : "Cerrar sesión"}</span>
          </button>
        </div>
      </aside>

      {/* Contenedor Principal (<main>) con fondo bg-black y padding p-4 md:p-8 */}
      <main className="m-admin-main min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-black p-4 md:p-8">
        <div className="w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
