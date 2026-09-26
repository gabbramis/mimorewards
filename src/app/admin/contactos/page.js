"use client";
import { useState, useEffect } from "react";
import { Search, Plus, MoreVertical, CheckCircle2, UserPlus, RefreshCcw } from "lucide-react";
import { createClient } from '@/lib/supabase/client';

export default function ContactsCRM() {
    const [searchTerm, setSearchTerm] = useState("");
    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stampSuccessId, setStampSuccessId] = useState(null);

    const supabase = createClient();
    const BUSINESS_ID = "ea6ae0d6-c8db-4b15-a09d-9726f93b7119";

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('business_id', BUSINESS_ID)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCustomers(data || []);
        } catch (err) {
            console.error("Error fetching customers:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const handleManualStamp = async (id, currentStamps) => {
        // Optimistic UI update
        setCustomers(customers.map(c => {
            if (c.id === id) {
                return { ...c, current_stamps: Math.min(10, currentStamps + 1) };
            }
            return c;
        }));
        setStampSuccessId(id);

        try {
            const res = await fetch('/api/stamps/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: id, method: 'MANUAL' })
            });
            if (!res.ok) {
                console.error("API error while updating");
                fetchCustomers(); // revert optimistic on error
            }
        } catch (err) {
            console.error(err);
            fetchCustomers();
        }

        setTimeout(() => {
            setStampSuccessId(null);
        }, 2000);
    };

    const filtered = customers.filter(c =>
        ((c.first_name + " " + c.last_name).toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.unique_code?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.phone?.includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-6 sm:p-10 max-w-6xl mx-auto font-sans">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Directorio de Clientes</h1>
                    <p className="text-gray-500 text-sm mt-1.5 font-medium">Gestiona tu base de clientes y sella manualmente aquellos sin batería.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={fetchCustomers} className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-gray-50 transition shadow-sm">
                        <RefreshCcw size={18} className={isLoading ? "animate-spin" : ""} />
                        Refrescar
                    </button>
                    <a href={`/unirse/${BUSINESS_ID}`} target="_blank" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-blue-700 transition shadow-sm">
                        <UserPlus size={18} />
                        Ver App Registro
                    </a>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex gap-4 bg-gray-50/50">
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por código CLI, nombre del cliente o teléfono..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm text-gray-900 font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 text-gray-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-bold border-b border-gray-100">CÓDIGO</th>
                                <th className="px-6 py-4 font-bold border-b border-gray-100">CLIENTE</th>
                                <th className="px-6 py-4 font-bold border-b border-gray-100">CUMPLEAÑOS</th>
                                <th className="px-6 py-4 font-bold border-b border-gray-100">PROGRESO</th>
                                <th className="px-6 py-4 font-bold border-b border-gray-100">ÚLTIMA VISITA</th>
                                <th className="px-6 py-4 font-bold border-b border-gray-100 text-right">ACCIONES</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading && customers.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">
                                        <RefreshCcw size={24} className="animate-spin mx-auto mb-2 text-gray-300" />
                                        Cargando base de clientes de Supabase...
                                    </td>
                                </tr>
                            ) : filtered.map(c => (
                                <tr key={c.id} className="hover:bg-gray-50/80 transition group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="font-mono text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-md border border-gray-200">{c.unique_code}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-semibold text-gray-900">{c.first_name} {c.last_name}</div>
                                        <div className="text-gray-400 text-xs mt-0.5 font-medium">{c.phone || "Sin teléfono"}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">{c.birthdate}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(c.current_stamps / 10) * 100}%` }}></div>
                                            </div>
                                            <span className="text-xs font-bold text-gray-700 w-8">{c.current_stamps}/10</span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1 font-medium">{c.total_visits || 0} visitas totales</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                                        {c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        {stampSuccessId === c.id ? (
                                            <span className="inline-flex items-center justify-center gap-1.5 text-green-700 text-sm font-bold bg-green-100 px-4 py-2 rounded-xl transition-all">
                                                <CheckCircle2 size={16} /> ¡Agregado!
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => handleManualStamp(c.id, c.current_stamps)}
                                                disabled={c.current_stamps >= 10}
                                                className="bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-gray-900 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shadow-sm"
                                            >
                                                +1 Sello Manual
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!isLoading && filtered.length === 0 && (
                    <div className="p-12 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4">
                            <Search size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Sin clientes registrados</h3>
                        <p className="text-gray-500 font-medium max-w-sm mt-1">No hay clientes por ahora. Usa el botón "Ver App Registro" para dar de alta tu primer cliente con Supabase.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
