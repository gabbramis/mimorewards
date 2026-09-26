"use client";

import Link from "next/link";
<<<<<<< HEAD
import { usePathname, useRouter } from "next/navigation";
import { Users, LayoutDashboard, MessageSquare, Megaphone, Settings, LogOut } from "lucide-react";
import { createClient } from '@/lib/supabase/client';
=======
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Users, LayoutDashboard, MessageSquare, Megaphone, Settings, Store, Menu, X, ChevronRight } from "lucide-react";
>>>>>>> 20da279a245f49a22624661fcc45fb074778e5b1

const navItems = [
    ["/admin/negocios", "Negocios", Store],
    ["/admin/metricas", "Métricas", LayoutDashboard],
    ["/admin/contactos", "Clientes", Users],
    ["/admin/conversaciones", "Conversaciones", MessageSquare],
    ["/admin/automatizaciones", "Automatizaciones", Megaphone],
    ["/admin/ajustes", "Ajustes", Settings],
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
<<<<<<< HEAD
    const router = useRouter();
    const supabase = createClient();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };
=======
    const [sidebarOpen, setSidebarOpen] = useState(false);
>>>>>>> 20da279a245f49a22624661fcc45fb074778e5b1

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
                    <Link href="/admin/metricas" className="m-admin-brand" aria-label="mimo rewards, panel de administración" onClick={() => setSidebarOpen(false)}>
                        <Image src="/images/mimo-wordmark.png" width={1220} height={469} alt="mimo rewards" priority />
                        <span>Panel para comercios</span>
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
<<<<<<< HEAD
                <div className="p-5 border-t border-gray-100 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                            L
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-semibold text-gray-900 truncate">El Gran Cafe</p>
                            <p className="text-xs text-blue-600 font-medium truncate">Plan Inception</p>
=======
                <div className="m-admin-account p-5">
                    <div className="flex items-center gap-3">
                        <div className="m-admin-avatar w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-lg shadow-sm">
                            L
                        </div>
                        <div>
                            <p className="text-sm font-semibold">El Gran Café</p>
                            <p className="text-xs font-medium">Programa activo</p>
>>>>>>> 20da279a245f49a22624661fcc45fb074778e5b1
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-red-600 transition-colors w-full p-2 hover:bg-red-50 rounded-lg justify-start"
                    >
                        <LogOut size={18} /> Cerrar sesión
                    </button>
                </div>
            </aside>
            <main className="m-admin-main flex-1 overflow-auto">
                <div className="m-admin-mobile-header">
                    <button className="m-admin-menu" aria-label="Abrir menú" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
                    <Image src="/images/mimo-wordmark.png" width={1220} height={469} alt="mimo rewards" />
                    <span>Panel</span>
                </div>
                {children}
            </main>
        </div>
    );
}
