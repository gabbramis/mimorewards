"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { Users, LayoutDashboard, BarChart3, MessageSquare, Megaphone, Settings, Sliders, Store, Menu, X, ChevronRight, ShieldCheck, LogOut, PlusCircle, Zap, QrCode, History } from "lucide-react";
import { createClient } from '@/lib/supabase/client';
import { useBusiness } from "@/contexts/BusinessContext";

const internalNavItems = [
    ["/admin", "Dashboard", LayoutDashboard],
    ["/admin/negocios", "Negocios", Store],
    ["/admin/comunicaciones", "Comunicaciones", Megaphone],
    ["/admin/contactos", "Clientes", Users],
    ["/admin/configuracion", "Configuración", Sliders],
] as const;

const CREATOR_EMAIL = "creator@mimorewards.com";
const CREATOR_ONLY_PATHS = ["/admin/crear-comercio"];

export default function AdminShell({ children, mode = "internal", businessId, businessName }: { children: ReactNode; mode?: "internal" | "merchant"; businessId?: string; businessName?: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCreator, setIsCreator] = useState(false);
    const { businessName: ctxName, logoUrl, primaryColor } = useBusiness();

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setIsCreator(data.user?.email?.toLowerCase() === CREATOR_EMAIL);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    if (pathname === "/admin/caja") {
        return <>{children}</>;
    }
    const navItems = mode === "merchant" && businessId
        ? [
            [`/comercio/${businessId}`, "Dashboard", LayoutDashboard],
            [`/comercio/${businessId}/escaner`, "Escáner", QrCode],
            [`/comercio/${businessId}/clientes`, "Clientes", Users],
            [`/comercio/${businessId}/historial`, "Historial de movimientos", History],
        ] as const
        : internalNavItems.filter(([href]) => isCreator || !(CREATOR_ONLY_PATHS as readonly string[]).includes(href));

    const getLinkClass = (path: string) => {
        const isActive = path === "/admin" || path === `/comercio/${businessId}`
            ? pathname === path
            : (pathname === path || pathname?.startsWith(path + '/'));
        const baseClass = "m-admin-nav-link flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150";
        if (isActive) {
            return `${baseClass} is-active font-medium`;
        }
        return `${baseClass} font-normal`;
    };

    return (
        <div className="m-admin-shell flex h-screen font-sans">
            {sidebarOpen && <button className="m-admin-backdrop" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)} />}
            <aside className={`m-admin-sidebar flex flex-col ${sidebarOpen ? "is-open" : ""}`}>
                <div className="m-admin-brand-row flex items-center justify-between">
                    <Link href={mode === "merchant" && businessId ? `/comercio/${businessId}` : "/admin"} className="m-admin-brand" aria-label="mimo rewards, panel de administración" onClick={() => setSidebarOpen(false)}>
                        <Image src="/images/mimo-wordmark.png" width={1220} height={469} alt="mimo rewards" priority />
                        <span>{mode === "merchant" ? "Espacio de tu comercio" : "Panel interno de mimo"}</span>
                    </Link>
                    <button className="m-admin-close" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
                </div>
                <nav className="m-admin-nav flex-1 px-4 py-6 space-y-2 overflow-y-auto" aria-label="Navegación del panel">
                    <p className="m-admin-nav-label">GESTIÓN</p>
                    {navItems.map(([href, label, Icon]) => (
                        <Link key={href} href={href} className={getLinkClass(href)} onClick={() => setSidebarOpen(false)}>
                            <Icon size={19} strokeWidth={1.9} />
                            <span>{label}</span>
                            <ChevronRight className="m-admin-nav-arrow" size={15} />
                        </Link>
                    ))}
                </nav>
                <div className="border-t border-[#D5CFC4] p-3">
                    <button
                        type="button"
                        onClick={handleLogout}
                        title="Cerrar sesión"
                        className="group flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white p-2.5 text-left transition-colors hover:border-[#FFD9DC] hover:bg-[#FFF0F1]/40 cursor-pointer"
                    >
                        <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                            {mode === "merchant" && logoUrl ? (
                                <img
                                    src={logoUrl}
                                    alt="Logo del comercio"
                                    className="h-9 w-9 shrink-0 rounded-xl object-cover border border-gray-200 bg-white shadow-2xs"
                                />
                            ) : (
                                <div
                                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF1F2D]/10 text-[#FF1F2D] font-bold text-xs border border-[#FFD9DC]"
                                    style={mode === "merchant" && primaryColor ? { backgroundColor: primaryColor, color: "#FFFFFF" } : undefined}
                                >
                                    {mode === "merchant" ? ((ctxName || businessName) ? (ctxName || businessName)!.slice(0, 2).toUpperCase() : "?") : "EM"}
                                </div>
                            )}
                            <div className="min-w-0">
                                <span className="block truncate text-xs font-bold text-[#1F1F1F]">
                                    {mode === "merchant" ? (ctxName || businessName || "Sin Nombre") : "Equipo Mimo"}
                                </span>
                            </div>
                        </div>
                        <span className="rounded-lg p-1.5 text-[#737373] group-hover:bg-[#FFF0F1] group-hover:text-[#FF1F2D] transition-colors shrink-0 ml-1.5">
                            <LogOut size={15} />
                        </span>
                    </button>
                </div>
            </aside>
            <main className="m-admin-main flex-1 overflow-auto relative">
                <div className="m-admin-mobile-header">
                    <button className="m-admin-menu" aria-label="Abrir menú" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
                    <Image src="/images/mimo-wordmark.png" width={1220} height={469} alt="mimo rewards" />
                    <span>{mode === "merchant" ? (businessName || "Comercio") : "Panel"}</span>
                </div>
                {children}
            </main>
        </div>
    );
}
