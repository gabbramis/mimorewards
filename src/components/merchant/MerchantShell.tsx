"use client";

import React, { useState } from "react";
import Link from "next/link";
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
import NotificationBell from "./NotificationBell";

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
  const { isFreePlan: contextIsFree } = useBusiness();
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
    <div className="m-merchant-shell flex flex-col h-dvh w-full bg-black text-white font-sans antialiased overflow-hidden">
      {/* Banner superior adhesivo de Impersonation (Modo Administrador) */}
      {isImpersonating && (
        <div
          role="region"
          aria-label="Modo Administrador"
          className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-zinc-900 px-4 py-2.5 text-white border-b border-zinc-800 shrink-0"
        >
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-tight text-zinc-200">
            <ShieldAlert size={16} className="shrink-0 text-white" />
            <span>
              Modo Administrador: Estás viendo la cuenta de <strong className="text-white">{businessName}</strong>
            </span>
          </div>
          <form action={stopImpersonation}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-gray-200 cursor-pointer"
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
          <div role="status" className="fixed bottom-6 left-4 right-4 sm:left-auto sm:max-w-sm sm:right-6 z-50 flex items-center gap-3 rounded-2xl bg-zinc-900 text-white px-5 py-3.5 border border-zinc-800 text-xs font-semibold animate-in slide-in-from-bottom-2 duration-200">
            <Lock size={15} className="text-zinc-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Mobile Backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar Persistente (260px) */}
        <aside
          id="merchant-navigation"
          aria-label="Navegación del comercio"
          className={`fixed inset-y-0 left-0 z-50 flex w-[260px] max-w-[86vw] shrink-0 overflow-y-auto flex-col justify-between border-r border-zinc-800 bg-zinc-950 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
            sidebarOpen ? "visible translate-x-0" : "invisible -translate-x-full md:visible"
          }`}
        >
          <div className="flex flex-col">
            {/* Brand Header */}
            <div className="flex h-16 md:h-20 items-center justify-between border-b border-zinc-800 px-5 box-border">
              <Link
                href={`/comercio/${businessId}`}
                className="flex items-center"
                onClick={() => setSidebarOpen(false)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/mimo-wordmark.png"
                  alt="mimo rewards"
                  className="h-8 w-auto object-contain block brightness-0 invert"
                />
              </Link>
              <button
                type="button"
                aria-label="Cerrar menú de navegación"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white md:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-1 px-3 py-5">
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
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
                      className="group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium opacity-50 cursor-not-allowed select-none text-zinc-500 hover:bg-zinc-900/40 transition-colors"
                      title="Función bloqueada - Requiere Plan Pro"
                    >
                      <Icon size={17} className="text-zinc-600 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      <Lock size={13} className="text-zinc-500 shrink-0 ml-auto" />
                    </button>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-zinc-900 text-white font-semibold border border-zinc-800"
                        : "text-zinc-400 hover:bg-zinc-900/60 hover:text-white border border-transparent"
                    }`}
                  >
                    <Icon
                      size={17}
                      className={`transition-colors ${
                        active ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                      }`}
                    />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight
                      size={13}
                      className={`transition-transform ${
                        active ? "text-zinc-400 opacity-80 translate-x-0.5" : "text-zinc-500 opacity-0 group-hover:opacity-60"
                      }`}
                    />
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer Profile & Logout */}
          <div className="border-t border-zinc-800 p-3">
            <div className="flex items-center justify-between rounded-xl bg-zinc-900 p-2.5 border border-zinc-800">
              <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                {businessLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={businessLogo}
                    alt={businessName}
                    className="h-9 w-9 shrink-0 rounded-xl object-cover border border-zinc-700 bg-zinc-950"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-white font-semibold text-xs border border-zinc-700">
                    {businessName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white">
                    {businessName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Cerrar sesión"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors shrink-0 ml-1.5"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Container */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-black">
          {/* Top Navbar Header */}
          <header className="flex h-16 md:h-20 shrink-0 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950 px-4 md:px-8 box-border">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white md:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="Abrir menú de navegación"
                aria-expanded={sidebarOpen}
                aria-controls="merchant-navigation"
              >
                <Menu size={20} />
              </button>

              {/* Logo en móvil + Título de la sección y estado del programa centrados en el mismo eje vertical */}
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <Link
                  href={`/comercio/${businessId}`}
                  className="flex md:hidden items-center shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/mimo-wordmark.png"
                    alt="mimo rewards"
                    className="h-7 w-auto object-contain block brightness-0 invert"
                  />
                </Link>
                <h1 className="hidden sm:block text-base sm:text-lg font-semibold text-white tracking-tight leading-none truncate">
                  Panel de comercio
                </h1>
                <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-900 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-300 border border-zinc-800">
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-zinc-500"}`} />
                  {isActive ? "Programa Activo" : "Pausado"}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex shrink-0 items-center gap-2.5">
              <NotificationBell businessId={businessId} />
              <button
                type="button"
                onClick={handleCopyCardLink}
                aria-label={copiedLink ? "¡Link copiado!" : "Copiar link de tarjeta"}
                className={`inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-xl border px-3 sm:px-3.5 py-2 text-xs font-semibold transition-colors ${
                  copiedLink
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {copiedLink ? (
                  <>
                    <Check size={14} className="text-emerald-400" />
                    <span className="hidden lg:inline">¡Link copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} className="text-zinc-400" />
                    <span className="hidden lg:inline">Copiar link de tarjeta</span>
                  </>
                )}
              </button>
            </div>
          </header>

          {/* Content Body */}
          <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-black p-4 md:p-8">
            <div className="w-full max-w-7xl mx-auto min-w-0">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
