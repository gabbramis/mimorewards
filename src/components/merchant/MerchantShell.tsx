"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  History,
  Copy,
  Check,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Megaphone,
  QrCode,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useBusiness, isPlanFree } from "@/contexts/BusinessContext";
import { stopImpersonation } from "@/app/actions/impersonation";
import UpgradeModal from "./UpgradeModal";

interface MerchantShellProps {
  children: React.ReactNode;
  businessId: string;
  businessName: string;
  businessSlug?: string | null;
  businessLogo?: string | null;
  isActive?: boolean;
  showCommunications?: boolean;
  planType?: string | null;
  isImpersonating?: boolean;
}

export default function MerchantShell({
  children,
  businessId,
  businessName,
  businessSlug,
  businessLogo,
  isActive = true,
  showCommunications = false,
  planType,
  isImpersonating = false,
}: MerchantShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { planType: contextPlanType, isFreePlan: contextIsFree } = useBusiness();
  const isFree = planType !== undefined ? isPlanFree(planType) : contextIsFree;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalTitle, setUpgradeModalTitle] = useState("Función exclusiva del Plan Pro");
  const [upgradeModalDesc, setUpgradeModalDesc] = useState<string | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showUpgradeToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const navItems = [
    {
      href: `/comercio/${businessId}`,
      label: "Dashboard",
      icon: LayoutDashboard,
      exact: true,
      requiresPro: false,
    },
    {
      href: `/comercio/${businessId}/escaner`,
      label: "Escáner",
      icon: QrCode,
      exact: false,
      requiresPro: false,
    },
    {
      href: `/comercio/${businessId}/clientes`,
      label: "Clientes",
      icon: Users,
      exact: false,
      requiresPro: false,
    },
    {
      href: `/comercio/${businessId}/historial`,
      label: "Historial de movimientos",
      icon: History,
      exact: false,
      requiresPro: false,
    },
    {
      href: `/comercio/${businessId}/comunicaciones`,
      label: "Comunicaciones",
      icon: Megaphone,
      exact: false,
      requiresPro: true,
    },
  ];

  const handleCopyCardLink = async () => {
    try {
      const slugOrId = businessSlug || businessId;
      const cardUrl = `https://mimorewards.com/t/${slugOrId}`;
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
    <div className="m-merchant-shell flex flex-col h-dvh w-full bg-[#FFF9F5] text-[#1F1F1F] font-sans antialiased overflow-hidden">
      {/* Banner superior adhesivo de Impersonation (Modo Administrador) */}
      {isImpersonating && (
        <div
          role="region"
          aria-label="Modo Administrador"
          className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-[#FF1F2D] px-4 py-2.5 text-white shadow-md border-b border-red-700 shrink-0"
        >
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold tracking-tight">
            <ShieldAlert size={16} className="shrink-0" />
            <span>
              Modo Administrador: Estás viendo la cuenta de {businessName}
            </span>
          </div>
          <form action={stopImpersonation}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#FF1F2D] shadow-xs transition hover:bg-red-50 cursor-pointer"
            >
              <LogOut size={13} />
              <span>Cerrar sesión de cliente</span>
            </button>
          </form>
        </div>
      )}

      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Upgrade Modal */}
        <UpgradeModal
          isOpen={upgradeModalOpen}
          onClose={() => setUpgradeModalOpen(false)}
          title={upgradeModalTitle}
          description={upgradeModalDesc}
          feature="communications"
        />

        {/* Floating Upgrade Toast */}
        {toastMessage && (
          <div role="status" className="fixed bottom-6 left-4 right-4 sm:left-auto sm:max-w-sm sm:right-6 z-50 flex items-center gap-3 rounded-2xl bg-[#1F1F1F] text-white px-5 py-3.5 shadow-xl border border-neutral-700 text-xs font-semibold animate-in slide-in-from-bottom-2 duration-200">
            <Lock size={15} className="text-amber-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar Persistente (260px) */}
        <aside
          id="merchant-navigation"
          aria-label="Navegación del comercio"
          className={`fixed inset-y-0 left-0 z-50 flex w-[260px] max-w-[86vw] shrink-0 overflow-y-auto flex-col justify-between border-r border-[#D5CFC4] bg-white transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
            sidebarOpen ? "visible translate-x-0" : "invisible -translate-x-full md:visible"
          }`}
        >
          <div className="flex flex-col">
            {/* Brand Header: Altura fija h-20 (80px) idéntica a la Topbar para alineación continua */}
            <div className="flex h-20 items-center justify-between border-b border-[#D5CFC4] px-6 box-border">
              <Link
                href={`/comercio/${businessId}`}
                className="flex items-center"
                onClick={() => setSidebarOpen(false)}
              >
                <Image
                  src="/images/mimo-wordmark.png"
                  width={1220}
                  height={469}
                  alt="mimo rewards"
                  priority
                  className="w-24 h-auto object-contain"
                />
              </Link>
              <button
                type="button"
                aria-label="Cerrar menú de navegación"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[#737373] hover:bg-[#FFF9F5] hover:text-[#1F1F1F] md:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-1.5 px-3 py-5">
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#737373]">
                Gestión Operativa
              </p>
              {navItems.map((item) => {
                const active = isCurrentActive(item);
                const Icon = item.icon;
                const isLocked = item.requiresPro && isFree;

                if (isLocked) {
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => {
                        setSidebarOpen(false);
                        setUpgradeModalTitle("Comunicaciones está disponible en el Plan Pro");
                        setUpgradeModalDesc(
                          "Enviá notificaciones push ilimitadas y promociones automáticas a la pantalla de bloqueo de tus clientes. Mejorá tu plan para desbloquear esta sección."
                        );
                        setUpgradeModalOpen(true);
                        showUpgradeToast("Comunicaciones está bloqueado. Actualizá al Plan Pro para acceder.");
                      }}
                      className="group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold opacity-50 cursor-not-allowed select-none text-[#737373] hover:bg-[#FFF9F5]/70 transition-all duration-150"
                      title="Función bloqueada - Requiere Plan Pro"
                    >
                      <Icon size={17} className="text-[#A3A3A3] shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      <Lock size={13} className="text-[#737373] shrink-0 ml-auto" />
                    </button>
                  );
                }

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
          <div className="border-t border-[#D5CFC4] p-3">
            <div className="flex items-center justify-between rounded-xl bg-[#FFF9F5] p-2.5 border border-[#D5CFC4]">
              <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                {businessLogo ? (
                  <img
                    src={businessLogo}
                    alt={businessName}
                    className="h-9 w-9 shrink-0 rounded-xl object-cover border border-[#D5CFC4] bg-white shadow-2xs"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF1F2D]/10 text-[#FF1F2D] font-bold text-xs border border-[#FFD9DC]">
                    {businessName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[#1F1F1F]">
                    {businessName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Cerrar sesión"
                className="rounded-lg p-1.5 text-[#737373] hover:bg-[#FFF0F1] hover:text-[#FF1F2D] transition-colors shrink-0 ml-1.5"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Container */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top Navbar Header: Altura fija h-20 (80px) idéntica al Sidebar para alineación perfecta */}
          <header className="flex min-h-20 shrink-0 items-center justify-between gap-2 border-b border-[#D5CFC4] bg-white px-4 py-3 md:px-8 box-border">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3.5">
              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#737373] hover:bg-[#FFF9F5] hover:text-[#1F1F1F] md:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menú de navegación"
                aria-expanded={sidebarOpen}
                aria-controls="merchant-navigation"
              >
                <Menu size={18} />
              </button>

              {/* Título de la sección y estado del programa */}
              <div className="flex min-w-0 flex-col items-start gap-1 lg:flex-row lg:items-center lg:gap-3">
                <h1 className="text-base sm:text-lg font-bold text-[#1F1F1F] tracking-tight">
                  Panel de comercio
                </h1>
                <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#10B981] border border-[#A7F3D0]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                  {isActive ? "Programa Activo" : "Pausado"}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex shrink-0 items-center gap-2.5">
              <button
                type="button"
                onClick={handleCopyCardLink}
                aria-label={copiedLink ? "¡Link copiado!" : "Copiar link de tarjeta"}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl px-3 sm:px-3.5 py-2 text-xs font-semibold transition-all duration-150 ${
                  copiedLink
                    ? "bg-[#ECFDF5] text-[#10B981]"
                    : "text-[#1F1F1F] hover:bg-[#FFF9F5]"
                }`}
              >
                {copiedLink ? (
                  <>
                    <Check size={14} className="text-[#10B981]" />
                    <span className="hidden lg:inline">¡Link copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} className="text-[#737373]" />
                    <span className="hidden lg:inline">Copiar link de tarjeta</span>
                  </>
                )}
              </button>
            </div>
          </header>

          {/* Content Body */}
          <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#FFF9F5] p-4 md:p-8">
            <div className="w-full max-w-7xl mx-auto min-w-0">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
