import Link from "next/link";
import { Users, LayoutDashboard, MessageSquare, Megaphone, Settings, Store } from "lucide-react";

export default function AdminLayout({ children }) {
    return (
        <div className="flex h-screen bg-gray-50 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="h-16 flex items-center px-6 border-b border-gray-100">
                    <span className="font-bold text-xl text-gray-900 tracking-tight">Mimo Admin</span>
                </div>
                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                    <Link href="/admin/negocios" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition font-medium">
                        <Store size={20} />
                        <span>Negocios</span>
                    </Link>
                    <Link href="/admin/metricas" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition font-medium">
                        <LayoutDashboard size={20} />
                        <span>Métricas</span>
                    </Link>
                    <Link href="/admin/contactos" className="flex items-center gap-3 px-3 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-medium">
                        <Users size={20} />
                        <span>Contactos (CRM)</span>
                    </Link>
                    <Link href="/admin/conversaciones" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition font-medium">
                        <MessageSquare size={20} />
                        <span>Conversaciones</span>
                    </Link>
                    <Link href="/admin/automatizaciones" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition font-medium">
                        <Megaphone size={20} />
                        <span>Automatizaciones</span>
                    </Link>
                    <Link href="/admin/ajustes" className="flex items-center gap-3 px-3 py-2.5 text-gray-600 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition font-medium">
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
