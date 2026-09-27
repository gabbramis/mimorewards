"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, CheckCircle2, UserPlus, RefreshCcw, Settings, Edit3, X, Minus, Trash2, Link2 } from "lucide-react";
import { createClient } from '@/lib/supabase/client';

export type ContactsCRMProps = { businessId?: string; merchantMode?: boolean };

export function ContactsCRM({ businessId, merchantMode = false }: ContactsCRMProps = {}) {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stampSuccessId, setStampSuccessId] = useState(null);
    const [toastMessage, setToastMessage] = useState(null);
    const [testLinkLoadingId, setTestLinkLoadingId] = useState(null);
    const [redeemLoadingId, setRedeemLoadingId] = useState(null);
    const [testLinks, setTestLinks] = useState({});

    // Edit Mode states
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);

    const supabase = createClient();
    const getTargetStamps = (customer) => customer.businesses?.reward_target || 10;

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const fetchCustomers = useCallback(async () => {
        setIsLoading(true);
        try {
            // OPTIMIZATION: Only select required fields instead of *
            let customersQuery = supabase
                .from('customers')
                .select('id, unique_code, business_id, first_name, last_name, phone, birthdate, current_stamps, total_visits, last_visit_at, created_at, businesses(reward_target)')
                .order('created_at', { ascending: false });
            if (businessId) customersQuery = customersQuery.eq('business_id', businessId);
            const { data, error } = await customersQuery;

            if (error) throw error;
            setCustomers(data || []);
        } catch (err) {
            console.error("Error fetching customers:", err);
        } finally {
            setIsLoading(false);
        }
    }, [businessId, supabase]);

    useEffect(() => {
        // Hydrate the customer table once the client has mounted.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchCustomers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleManualStamp = async (id, currentStamps, targetStamps) => {
        // Optimistic UI update
        setCustomers(customers.map(c => {
            if (c.id === id) {
                return { ...c, current_stamps: Math.min(targetStamps, currentStamps + 1) };
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
            const payload = await res.json();
            if (!res.ok) {
                await fetchCustomers();
                if (payload.reason === 'reward_pending') {
                    showToast('La recompensa ya está disponible para canjear.');
                } else {
                    showToast(payload.error || 'No se pudo guardar el sello.');
                }
                setStampSuccessId(null);
                return;
            }
            await fetchCustomers();
            showToast(payload.message || 'Sello sumado correctamente.');
        } catch (err) {
            console.error(err);
            await fetchCustomers();
            setStampSuccessId(null);
            showToast("Hubo un error de conexión.");
        }

        setTimeout(() => {
            setStampSuccessId(null);
        }, 2000);
    };

    const handleRedeem = async (id) => {
        if (!window.confirm('¿Confirmás el canje de la recompensa?')) return;
        setRedeemLoadingId(id);
        try {
            const response = await fetch('/api/stamps/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: id }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'No se pudo canjear la recompensa.');
            setCustomers(current => current.map(customer => customer.id === id ? { ...customer, current_stamps: payload.currentStamps ?? 0 } : customer));
            showToast(payload.message || 'Recompensa canjeada correctamente.');
        } catch (redeemError) {
            showToast(redeemError instanceof Error ? redeemError.message : 'No se pudo canjear la recompensa.');
        } finally {
            setRedeemLoadingId(null);
        }
    };

    const handleTestTapLink = async (customerId) => {
        setTestLinkLoadingId(customerId);
        try {
            const response = await fetch('/api/admin/test-tap-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'No se pudo crear el link.');
            setTestLinks(current => ({ ...current, [customerId]: payload.url }));
            await navigator.clipboard?.writeText(payload.url);
            showToast('Link de prueba copiado. Vence en 10 minutos.');
        } catch (error) {
            showToast(error instanceof Error ? error.message : 'No se pudo crear el link.');
        } finally {
            setTestLinkLoadingId(null);
        }
    };

    // OPTIMIZATION: Memoize filtering logic to avoid re-calculating on simple re-renders
    const filtered = useMemo(() => customers.filter(c =>
        ((c.first_name + " " + c.last_name).toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.unique_code?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.phone?.includes(searchTerm.toLowerCase()))
    ), [customers, searchTerm]);

    return (
        <div className="p-6 sm:p-10 max-w-6xl mx-auto font-sans">
            {toastMessage && (
                <div className="fixed top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50 flex items-center gap-2 animate-in slide-in-from-top-2">
                    <CheckCircle2 className="text-green-400 w-4 h-4" />
                    {toastMessage}
                </div>
            )}

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Directorio de Clientes</h1>
                    <p className="text-gray-500 text-sm mt-1.5 font-medium">Gestiona tu base de clientes y sella manualmente aquellos sin batería.</p>
                </div>
                <div className="flex gap-3 items-center">
                    {!merchantMode && <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition shadow-sm border ${isEditMode ? 'bg-gray-900 text-white border-gray-900 ring-2 ring-gray-900 ring-offset-2' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                    >
                        <Settings size={18} className={isEditMode ? "animate-spin-slow" : ""} />
                        {isEditMode ? 'Editando...' : 'Modo Edición'}
                    </button>}
                    <button onClick={fetchCustomers} className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-gray-50 transition shadow-sm">
                        <RefreshCcw size={18} className={isLoading ? "animate-spin" : ""} />
                        Refrescar
                    </button>
                    {businessId && <a href={`/t/${businessId}`} target="_blank" rel="noreferrer" className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-blue-700 transition shadow-sm"><UserPlus size={18} /> Alta</a>}
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
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
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
                                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${Math.min(100, (c.current_stamps / getTargetStamps(c)) * 100)}%` }}></div>
                                            </div>
                                    <span className="text-xs font-bold text-gray-700 w-8">{c.current_stamps}/{getTargetStamps(c)}</span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1 font-medium">{c.total_visits || 0} visitas totales</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                                        {c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {isEditMode ? (
                                                <button
                                                    onClick={() => setEditingCustomer({ ...c })}
                                                    className="inline-flex items-center justify-center gap-1.5 text-blue-700 text-sm font-bold bg-blue-50 hover:bg-blue-100 border border-transparent hover:border-blue-200 px-4 py-2 rounded-xl transition-all shadow-sm"
                                                    title="Editar Cliente"
                                                >
                                                    <Edit3 size={16} /> Editar
                                                </button>
                                            ) : stampSuccessId === c.id ? (
                                                <span className="inline-flex items-center justify-center gap-1.5 text-green-700 text-sm font-bold bg-green-100 px-4 py-2 rounded-xl transition-all">
                                                    <CheckCircle2 size={16} /> ¡Agregado!
                                                </span>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleTestTapLink(c.id)}
                                                        disabled={testLinkLoadingId === c.id}
                                                        className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                                                        title="Genera un enlace temporal que usa el flujo NFC real"
                                                    >
                                                        <Link2 size={14} /> {testLinkLoadingId === c.id ? 'Creando…' : 'Link prueba'}
                                                    </button>
                                                    {testLinks[c.id] && <a href={testLinks[c.id]} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-700 hover:underline">Abrir</a>}
                                                    {c.current_stamps >= getTargetStamps(c) && <button
                                                        onClick={() => handleRedeem(c.id)}
                                                        disabled={redeemLoadingId === c.id}
                                                        className="bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 px-3 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm"
                                                    >
                                                        {redeemLoadingId === c.id ? 'Canjeando…' : 'Canjear'}
                                                    </button>}
                                                    <button
                                                        onClick={() => handleManualStamp(c.id, c.current_stamps, getTargetStamps(c))}
                                                        disabled={c.current_stamps >= getTargetStamps(c)}
                                                        className="bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-gray-900 px-3 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm"
                                                    >
                                                        +1 Manual
                                                    </button>
                                                </div>
                                            )}
                                        </div>
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
                        <p className="text-gray-500 font-medium max-w-sm mt-1">No hay clientes por ahora. Usa el botón &quot;Ver App Registro&quot; para dar de alta tu primer cliente con Supabase.</p>
                    </div>
                )}
            </div>

            {/* MODAL DE EDICIÓN */}
            {editingCustomer && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Edit3 className="w-5 h-5 text-gray-500" /> Editar Cliente
                            </h2>
                            <button onClick={() => setEditingCustomer(null)} className="text-gray-400 hover:text-gray-600 bg-white hover:bg-gray-50 rounded-full p-1.5 transition-colors shadow-sm border border-gray-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 block">Nombre</label>
                                    <input
                                        type="text"
                                        value={editingCustomer.first_name || ''}
                                        onChange={e => setEditingCustomer({ ...editingCustomer, first_name: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 block">Apellido</label>
                                    <input
                                        type="text"
                                        value={editingCustomer.last_name || ''}
                                        onChange={e => setEditingCustomer({ ...editingCustomer, last_name: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 block">Teléfono (WhatsApp)</label>
                                <input
                                    type="tel"
                                    value={editingCustomer.phone || ''}
                                    onChange={e => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 block">Fecha de Nacimiento</label>
                                <input
                                    type="date"
                                    value={editingCustomer.birthdate || ''}
                                    onChange={e => setEditingCustomer({ ...editingCustomer, birthdate: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 block">Ajuste de Sellos (Manual)</label>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setEditingCustomer({ ...editingCustomer, current_stamps: Math.max(0, (editingCustomer.current_stamps || 0) - 1) })}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2.5 rounded-lg transition-colors border border-gray-200 shadow-sm"
                                    >
                                        <Minus className="w-5 h-5" />
                                    </button>
                                    <div className="w-16 text-center font-bold text-xl text-gray-900 bg-gray-50 border border-gray-200 py-1.5 rounded-xl shadow-inner">
                                        {editingCustomer.current_stamps || 0}
                                    </div>
                                    <button
                                        onClick={() => setEditingCustomer({ ...editingCustomer, current_stamps: Math.min(10, (editingCustomer.current_stamps || 0) + 1) })}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2.5 rounded-lg transition-colors border border-gray-200 shadow-sm"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                            <button
                                onClick={async () => {
                                    if (confirm('¿Seguro que deseas eliminar este cliente permanentemente?')) {
                                        const prevCustomers = [...customers];
                                        // Optimistic Update
                                        setCustomers(prevCustomers.filter(c => c.id !== editingCustomer.id));
                                        setEditingCustomer(null);

                                        // Limpieza preventiva (si no hay CASCADE configurado estricto)
                                        await supabase.from('stamp_logs').delete().eq('customer_id', editingCustomer.id);
                                        await supabase.from('automation_logs').delete().eq('customer_id', editingCustomer.id);

                                        const { error } = await supabase.from('customers').delete().eq('id', editingCustomer.id);
                                        if (error) {
                                            setCustomers(prevCustomers);
                                            alert("Error al eliminar");
                                        } else {
                                            showToast('Cliente eliminado con éxito.');
                                            router.refresh(); // Invalidar caché para métricas globales
                                        }
                                    }
                                }}
                                className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-50 transition"
                            >
                                <Trash2 className="w-4 h-4" /> Eliminar
                            </button>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditingCustomer(null)}
                                    className="px-4 py-2 font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl shadow-sm hover:bg-gray-50 transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={async () => {
                                        // SINCRONIZACIÓN EXACTA DB
                                        const { count, error: countErr } = await supabase
                                            .from('stamp_logs')
                                            .select('*', { count: 'exact', head: true })
                                            .eq('customer_id', editingCustomer.id);

                                        const dbCount = count || 0;

                                        const { error } = await supabase.from('customers').update({
                                            first_name: editingCustomer.first_name,
                                            last_name: editingCustomer.last_name,
                                            phone: editingCustomer.phone,
                                            birthdate: editingCustomer.birthdate || null,
                                            current_stamps: editingCustomer.current_stamps
                                        }).eq('id', editingCustomer.id);

                                        if (!error && !countErr) {
                                            if (editingCustomer.current_stamps > dbCount) {
                                                const amountToInsert = editingCustomer.current_stamps - dbCount;
                                                const inserts = Array.from({ length: amountToInsert }).map(() => ({
                                                    customer_id: editingCustomer.id,
                                                    business_id: editingCustomer.business_id,
                                                    method: 'MANUAL',
                                                }));
                                                await supabase.from('stamp_logs').insert(inserts);
                                            }
                                            else if (editingCustomer.current_stamps < dbCount) {
                                                const amountToDelete = dbCount - editingCustomer.current_stamps;

                                                const { data: logsToDelete } = await supabase
                                                    .from('stamp_logs')
                                                    .select('id')
                                                    .eq('customer_id', editingCustomer.id)
                                                    .order('created_at', { ascending: false })
                                                    .limit(amountToDelete);

                                                if (logsToDelete && logsToDelete.length > 0) {
                                                    const ids = logsToDelete.map(log => log.id);
                                                    await supabase
                                                        .from('stamp_logs')
                                                        .delete()
                                                        .in('id', ids);
                                                }
                                            }

                                            // Optimistic table update instead of full refetch
                                            setCustomers(customers.map(c => c.id === editingCustomer.id ? editingCustomer : c));
                                            setEditingCustomer(null);
                                            showToast('Datos del cliente guardados.');
                                            router.refresh(); // Invalidar caché en el servidor
                                        } else {
                                            alert('Error al guardar: ' + error.message);
                                        }
                                    }}
                                    className="px-4 py-2 font-semibold text-white bg-gray-900 border border-gray-900 rounded-xl shadow hover:bg-gray-800 transition"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ContactsCRM;
