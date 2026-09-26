"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, LayoutDashboard, MessageSquare, Megaphone, Settings } from "lucide-react";

export default function AdminLayout({ children }) {
    const pathname = usePathname();

    const getLinkClass = (path) => {
        // En Next.js App Router, para verificar si la ruta es activa:
        const isActive = pathname === path || pathname?.startsWith(path + '/');

        const baseClass = "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150";
        if (isActive) {
            return `${baseClass} text-red-600 bg-red-50 font-medium`;
        }
        return `${baseClass} text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-normal`;
    };

    return (
        <div className="flex h-screen bg-gray-50 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="h-16 flex items-center px-6 border-b border-gray-100">
                    <span className="font-bold text-xl text-gray-900 tracking-tight">Mimo Admin</span>
                </div>
                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                    <Link href="/admin/metricas" className={getLinkClass("/admin/metricas")}>
                        <LayoutDashboard size={20} />
                        <span>Métricas</span>
                    </Link>
                    <Link href="/admin/contactos" className={getLinkClass("/admin/contactos")}>
                        <Users size={20} />
                        <span>Contactos (CRM)</span>
                    </Link>
                    <Link href="/admin/conversaciones" className={getLinkClass("/admin/conversaciones")}>
                        <MessageSquare size={20} />
                        <span>Conversaciones</span>
                    </Link>
                    <Link href="/admin/automatizaciones" className={getLinkClass("/admin/automatizaciones")}>
                        <Megaphone size={20} />
                        <span>Automatizaciones</span>
                    </Link>
                    <Link href="/admin/ajustes" className={getLinkClass("/admin/ajustes")}>
                        <Settings size={20} />
                        <span>Ajustes</span>
                    </Link>
                </nav>
                <div className="p-5 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                            L
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-900">El Gran Cafe</p>
                            <p className="text-xs text-blue-600 font-medium">Plan Inception</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-gray-50">
                {children}
            </main>
        </div>
    );
}
