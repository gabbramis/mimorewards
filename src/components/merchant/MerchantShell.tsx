"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  History,
  Settings,
  Copy,
  Check,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Store,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface MerchantShellProps {
  children: React.ReactNode;
  businessId: string;
  businessName: string;
  businessSlug?: string | null;
  businessLogo?: string | null;
  isActive?: boolean;
}

export default function MerchantShell({
  children,
  businessId,
  businessName,
  businessSlug,
  businessLogo,
  isActive = true,
}: MerchantShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const navItems = [
    {
      href: `/comercio/${businessId}`,
      label: "Dashboard",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      href: `/comercio/${businessId}/clientes`,
      label: "Clientes",
      icon: Users,
      exact: false,
    },
    {
      href: `/comercio/${businessId}/historial`,
      label: "Historial de movimientos",
      icon: History,
      exact: false,
    },
    {
      href: `/comercio/${businessId}/configuracion`,
      label: "Configuración del local",
      icon: Settings,
      exact: false,
    },
  ];

  const handleCopyCardLink = async () => {
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const slugOrId = businessSlug || businessId;
      const cardUrl = `${origin}/t/${slugOrId}`;
      await navigator.clipboard.writeText(cardUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      console.error("Failed to copy card link:", err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isCurrentActive = (item: (typeof navItems)[0]) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <div className="flex h-screen w-full bg-[#FFF9F5] text-[#1F1F1F] font-sans antialiased overflow-hidden">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Persistente (260px) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col justify-between border-r border-[#F0E6DE] bg-white transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col">
          {/* Brand Header */}
          <div className="flex items-center justify-between border-b border-[#F0E6DE] px-5 py-4">
            <Link
              href={`/comercio/${businessId}`}
              className="flex items-center gap-2.5"
              onClick={() => setSidebarOpen(false)}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF1F2D] text-white shadow-sm font-bold text-sm">
                M
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-[#1F1F1F] leading-tight">
                  mimo rewards
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
                  Panel de Comercio
                </span>
              </div>
            </Link>
            <button
              type="button"
              className="rounded-lg p-1.5 text-[#737373] hover:bg-[#FFF9F5] hover:text-[#1F1F1F] md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          {/* Store Pill */}
          <div className="mx-4 mt-4 mb-2 flex items-center gap-2.5 rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] p-2.5">
            {businessLogo ? (
              <img
                src={businessLogo}
                alt={businessName}
                className="h-8 w-8 rounded-lg object-cover border border-[#F0E6DE] bg-white"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF1F2D]/10 text-[#FF1F2D] font-bold text-xs">
                {businessName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-bold text-[#1F1F1F]">
                {businessName}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-[#10B981] font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse" />
                {isActive ? "Programa activo" : "En pausa"}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5 px-3 py-3">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#737373]">
              Gestión Operativa
            </p>
            {navItems.map((item) => {
              const active = isCurrentActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150 ${
                    active
                      ? "bg-[#FFF0F1] text-[#FF1F2D] shadow-sm"
                      : "text-[#525252] hover:bg-[#FFF9F5] hover:text-[#1F1F1F]"
                  }`}
                >
                  {/* Left accent bar */}
                  {active && (
                    <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#FF1F2D]" />
                  )}
                  <Icon
                    size={17}
                    className={`transition-colors ${
                      active ? "text-[#FF1F2D]" : "text-[#737373] group-hover:text-[#1F1F1F]"
                    }`}
                  />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight
                    size={13}
                    className={`transition-transform opacity-40 group-hover:opacity-100 ${
                      active ? "text-[#FF1F2D] translate-x-0.5" : "text-[#737373]"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Profile & Logout */}
        <div className="border-t border-[#F0E6DE] p-3">
          <div className="flex items-center justify-between rounded-xl bg-[#FFF9F5] p-2.5 border border-[#F0E6DE]">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-[#F0E6DE] text-[11px] font-bold text-[#1F1F1F]">
                <Store size={14} className="text-[#737373]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#1F1F1F]">
                  Comercio
                </p>
                <p className="text-[10px] text-[#737373] truncate">
                  {businessSlug ? `@${businessSlug}` : "Local autenticado"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              className="rounded-lg p-1.5 text-[#737373] hover:bg-[#FFF0F1] hover:text-[#FF1F2D] transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#F0E6DE] bg-white px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-[#F0E6DE] p-2 text-[#737373] hover:bg-[#FFF9F5] hover:text-[#1F1F1F] md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú de navegación"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#1F1F1F] sm:text-base tracking-tight">
                {businessName}
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#10B981] border border-[#A7F3D0]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                {isActive ? "Programa Activo" : "Pausado"}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyCardLink}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-xs transition-all duration-150 ${
                copiedLink
                  ? "border-[#10B981] bg-[#ECFDF5] text-[#10B981]"
                  : "border-[#F0E6DE] bg-white text-[#1F1F1F] hover:bg-[#FFF9F5] hover:border-[#E2D5CB]"
              }`}
            >
              {copiedLink ? (
                <>
                  <Check size={14} className="text-[#10B981]" />
                  <span>¡Link copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={14} className="text-[#737373]" />
                  <span className="hidden sm:inline">Copiar link de tarjeta</span>
                  <span className="sm:hidden">Copiar link</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto bg-[#FFF9F5] p-4 sm:p-6 md:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
