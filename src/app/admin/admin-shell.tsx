"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Users, LayoutDashboard, MessageSquare, Megaphone, Settings, Sliders, Store, Menu, X, ChevronRight, ShieldCheck, LogOut } from "lucide-react";
import { createClient } from '@/lib/supabase/client';

const internalNavItems = [
    ["/admin/negocios", "Negocios", Store],
    ["/admin/accesos", "Accesos", ShieldCheck],
    ["/admin/metricas", "Métricas", LayoutDashboard],
    ["/admin/contactos", "Clientes", Users],
    ["/admin/configuracion", "Configuración", Sliders],
] as const;

export default function AdminShell({ children, mode = "internal", businessId, businessName }: { children: ReactNode; mode?: "internal" | "merchant"; businessId?: string; businessName?: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };
    const navItems = mode === "merchant" && businessId
        ? [
            [`/comercio/${businessId}/metricas`, "Métricas", LayoutDashboard],
            [`/comercio/${businessId}/clientes`, "Clientes", Users],
            [`/comercio/${businessId}/configuracion`, "Configuración", Sliders]
        ] as const
        : internalNavItems;

    const getLinkClass = (path: string) => {
        const isActive = pathname === path || pathname?.startsWith(path + '/');
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
                    <Link href={mode === "merchant" && businessId ? `/comercio/${businessId}/metricas` : "/admin/metricas"} className="m-admin-brand" aria-label="mimo rewards, panel de administración" onClick={() => setSidebarOpen(false)}>
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
                <div className="m-admin-account p-5">
                    <div className="flex items-center gap-3">
                        <div className="m-admin-avatar w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-lg shadow-sm">
                            L
                        </div>
                        <div>
                            <p className="text-sm font-semibold">{mode === "merchant" ? (businessName || "Tu comercio") : "Equipo mimo"}</p>
                            <p className="text-xs font-medium">{mode === "merchant" ? "Programa activo" : "Administración"}</p>
                        </div>
                    </div>
                </div>
            </aside>
            <main className="m-admin-main flex-1 overflow-auto relative">
                {/* Botón flotante para salir */}
                <button
                    onClick={handleLogout}
                    title="Cerrar sesión"
                    className="fixed top-6 right-6 sm:top-10 sm:right-15 z-50 flex items-center justify-center bg-slate-900/90 text-white w-[50px] h-[50px] rounded-full shadow-md backdrop-blur-md border border-white/10 hover:bg-[#FF1F2D] transition-colors"
                >
                    <LogOut size={18} strokeWidth={2.2} />
                </button>

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
