"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Search, Plus, CheckCircle2, UserPlus, RefreshCcw, Settings, Edit3, X,
    Minus, Trash2, Link2, User, ArrowLeft, Store, Building2, ChevronRight, Loader2,
    History, Stamp, Gift, Smartphone, QrCode, Lock, Sparkles, Zap, Phone, Calendar
} from "lucide-react";
import { createClient } from '@/lib/supabase/client';
import { isPlanFree } from '@/contexts/BusinessContext';
import UpgradeModal from '@/components/merchant/UpgradeModal';

export type ContactsCRMProps = { businessId?: string; merchantMode?: boolean };

type Business = {
    id: string;
    name: string;
    logo_url?: string | null;
    reward_target?: number;
    reward_description?: string;
    primary_color?: string | null;
    active?: boolean;
    plan_type?: string;
    plan?: string;
};

function initials(name: string) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "?";
}

function getInactivityStatus(lastVisitAt?: string | null, createdAt?: string | null) {
    const visitDate = lastVisitAt || createdAt;
    if (!visitDate) {
        return {
            status: "inactive",
            label: "Inactivo (+25d)",
            badgeText: "+25d",
            borderColor: "border-2 border-red-500",
            bgColor: "bg-red-50",
            iconColor: "text-red-500",
            badgeClass: "bg-red-50 text-red-700 border-red-200",
            dotColor: "bg-red-500",
        };
    }
    const diffDays = Math.max(0, Math.floor((Date.now() - new Date(visitDate).getTime()) / (1000 * 60 * 60 * 24)));
    if (diffDays <= 7) {
        // Verde: 0 a 7 días.
        return {
            status: "active",
            label: "Activo (0-7d)",
            badgeText: diffDays === 0 ? "Hoy" : diffDays === 1 ? "Ayer" : `Hace ${diffDays}d`,
            borderColor: "border-2 border-emerald-500",
            bgColor: "bg-emerald-50",
            iconColor: "text-emerald-600",
            badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
            dotColor: "bg-emerald-500",
        };
    } else if (diffDays <= 24) {
        // Gris azulado: 8 a 24 días.
        return {
            status: "risk",
            label: "Riesgo (8-24d)",
            badgeText: `Hace ${diffDays}d`,
            borderColor: "border-2 border-slate-400",
            bgColor: "bg-slate-50",
            iconColor: "text-slate-600",
            badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
            dotColor: "bg-slate-400",
        };
    } else {
        // Rojo: 25 días o más.
        return {
            status: "inactive",
            label: "Inactivo (+25d)",
            badgeText: `Hace ${diffDays}d`,
            borderColor: "border-2 border-red-500",
            bgColor: "bg-red-50",
            iconColor: "text-red-500",
            badgeClass: "bg-red-50 text-rose-700 border-rose-200",
            dotColor: "bg-rose-500",
        };
    }
}

export function ContactsCRM({ businessId: initialBusinessId, merchantMode = false }: ContactsCRMProps = {}) {
    const router = useRouter();
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [isLoadingBusinesses, setIsLoadingBusinesses] = useState(true);
    const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
    const [businessSearchTerm, setBusinessSearchTerm] = useState("");

    const [searchTerm, setSearchTerm] = useState("");
    const [activeFilter, setActiveFilter] = useState<"all" | "active" | "risk" | "inactive">("all");
    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [stampSuccessId, setStampSuccessId] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [testLinkLoadingId, setTestLinkLoadingId] = useState<string | null>(null);
    const [redeemLoadingId, setRedeemLoadingId] = useState<string | null>(null);
    const [testLinks, setTestLinks] = useState<Record<string, string>>({});

    // Edit Mode states
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<any>(null);
    const [profileCustomer, setProfileCustomer] = useState<any>(null);
    const [historyLogs, setHistoryLogs] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

    const supabase = createClient();
    const getTargetStamps = (customer: any) => customer.businesses?.reward_target || selectedBusiness?.reward_target || 10;

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const fetchBusinesses = useCallback(async () => {
        setIsLoadingBusinesses(true);
        try {
            const response = await fetch('/api/admin/businesses', { cache: 'no-store' });
            const payload = await response.json();
            if (response.ok) {
                const list: Business[] = payload.businesses || [];
                setBusinesses(list);
                if (initialBusinessId) {
                    const found = list.find(b => b.id === initialBusinessId);
                    if (found) setSelectedBusiness(found);
                }
            }
        } catch (err) {
            console.error("Error al cargar negocios:", err);
        } finally {
            setIsLoadingBusinesses(false);
        }
    }, [initialBusinessId]);

    const fetchCustomers = useCallback(async () => {
        setIsLoading(true);
        setLoadError(null);
        try {
            const response = await fetch('/api/admin/customers', { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'No se pudo cargar la lista de clientes.');
            setCustomers(payload.customers || []);
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : 'No se pudo cargar la lista de clientes.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBusinesses();
        fetchCustomers();
    }, [fetchBusinesses, fetchCustomers]);

    // Conteo de clientes por negocio
    const customerCountsByBusiness = useMemo(() => {
        const counts = new Map<string, number>();
        customers.forEach((c: any) => {
            if (c.business_id) {
                counts.set(c.business_id, (counts.get(c.business_id) || 0) + 1);
            }
        });
        return counts;
    }, [customers]);

    // Comercios filtrados por búsqueda en la Vista 1
    const filteredBusinesses = useMemo(() => {
        const query = businessSearchTerm.trim().toLowerCase();
        if (!query) return businesses;
        return businesses.filter(b => b.name?.toLowerCase().includes(query));
    }, [businesses, businessSearchTerm]);

    // Negocio activo actual
    const currentBusiness = selectedBusiness || (initialBusinessId ? businesses.find(b => b.id === initialBusinessId) : null);
    const isCurrentBusinessFree = currentBusiness ? isPlanFree(currentBusiness.plan_type && currentBusiness.plan_type !== "inicial" ? currentBusiness.plan_type : currentBusiness.plan || currentBusiness.plan_type) : false;

    const openCustomerHistory = async (cust: any) => {
        setProfileCustomer(cust);
        if (isCurrentBusinessFree) {
            setHistoryLogs([]);
            return;
        }
        setHistoryLoading(true);
        try {
            const bizId = cust.business_id || currentBusiness?.id;
            const res = await fetch(`/api/merchant/customers/${encodeURIComponent(cust.id)}/history?businessId=${encodeURIComponent(bizId || "")}`, { cache: "no-store" });
            if (res.ok) {
                const payload = await res.json();
                setHistoryLogs(Array.isArray(payload.logs) ? payload.logs : []);
            } else {
                const { data } = await supabase.from("stamp_logs").select("id, customer_id, business_id, method, stamps_added, metadata, created_at").eq("customer_id", cust.id).eq("business_id", bizId).order("created_at", { ascending: false }).limit(200);
                setHistoryLogs(data || []);
            }
        } catch {
            setHistoryLogs([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    // Clientes exclusivos del negocio seleccionado
    const businessCustomers = useMemo(() => {
        if (!currentBusiness) return [];
        return customers.filter((c: any) => c.business_id === currentBusiness.id);
    }, [customers, currentBusiness]);

    const handleManualStamp = async (id: string, currentStamps: number, targetStamps: number) => {
        // Optimistic UI update
        setCustomers(customers.map((c: any) => {
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

    const handleRedeem = async (id: string) => {
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
            setCustomers((current: any) => current.map((customer: any) => customer.id === id ? { ...customer, current_stamps: payload.currentStamps ?? 0 } : customer));
            showToast(payload.message || 'Recompensa canjeada correctamente.');
        } catch (redeemError) {
            showToast(redeemError instanceof Error ? redeemError.message : 'No se pudo canjear la recompensa.');
        } finally {
            setRedeemLoadingId(null);
        }
    };

    const handleTestTapLink = async (customerId: string) => {
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

    // Contadores para chips basados en el negocio seleccionado
    const counts = useMemo(() => {
        let active = 0, risk = 0, inactive = 0;
        businessCustomers.forEach((c: any) => {
            const st = getInactivityStatus(c.last_visit_at, c.created_at);
            if (st.status === "active") active++;
            else if (st.status === "risk") risk++;
            else if (st.status === "inactive") inactive++;
        });
        return { all: businessCustomers.length, active, risk, inactive };
    }, [businessCustomers]);

    // Filtrado con semáforo y búsqueda
    const filtered = useMemo(() => businessCustomers.filter((c: any) => {
        const matchesSearch =
            ((c.first_name + " " + c.last_name).toLowerCase().includes(searchTerm.toLowerCase())) ||
            (c.unique_code?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (c.phone?.includes(searchTerm.toLowerCase()));
        if (!matchesSearch) return false;

        if (activeFilter === "all") return true;
        const st = getInactivityStatus(c.last_visit_at, c.created_at);
        return st.status === activeFilter;
    }), [businessCustomers, searchTerm, activeFilter]);

    return (
        <div className="w-full px-4 sm:px-8 py-6 font-sans">
            {toastMessage && (
                <div className="fixed top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium z-50 flex items-center gap-2 animate-in slide-in-from-top-2">
                    <CheckCircle2 className="text-green-400 w-4 h-4" />
                    {toastMessage}
                </div>
            )}

            {/* VISTA 1: LISTA / GRILLA DE NEGOCIOS (selectedBusiness === null) */}
            {!currentBusiness ? (
                <div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Directorio de Clientes</h1>
                            <p className="text-gray-500 text-sm mt-1.5 font-medium">
                                Seleccioná un comercio para ver y gestionar su base de clientes.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative w-full sm:w-64">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={businessSearchTerm}
                                    onChange={(e) => setBusinessSearchTerm(e.target.value)}
                                    placeholder="Buscar comercio…"
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF1F2D] focus:border-[#FF1F2D] outline-none transition text-sm text-gray-900"
                                />
                            </div>
                            <button
                                onClick={() => { fetchBusinesses(); fetchCustomers(); }}
                                className="bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-gray-50 transition shadow-xs"
                                title="Actualizar datos"
                            >
                                <RefreshCcw size={16} className={isLoadingBusinesses ? "animate-spin" : ""} />
                            </button>
                        </div>
                    </div>

                    {isLoadingBusinesses ? (
                        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                            <Loader2 size={32} className="animate-spin mb-3 text-[#FF1F2D]" />
                            <p className="text-sm font-medium">Cargando comercios…</p>
                        </div>
                    ) : businesses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-20 text-center">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-[#FF1F2D]">
                                <Store size={32} strokeWidth={1.8} />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900">No hay comercios registrados</h2>
                            <p className="mt-1 text-sm text-gray-500 max-w-sm">
                                Creá tu primer comercio para poder asociar y gestionar clientes.
                            </p>
                        </div>
                    ) : filteredBusinesses.length === 0 ? (
                        <div className="flex flex-col items-center py-16 text-center text-gray-500">
                            <Search size={32} className="mb-2 text-gray-300" />
                            <p className="font-semibold text-gray-900">Sin resultados para &ldquo;{businessSearchTerm}&rdquo;</p>
                            <button onClick={() => setBusinessSearchTerm("")} className="mt-2 text-xs font-semibold text-[#FF1F2D] hover:underline">
                                Limpiar búsqueda
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {filteredBusinesses.map((b) => {
                                const totalClients = customerCountsByBusiness.get(b.id) || 0;
                                return (
                                    <div
                                        key={b.id}
                                        onClick={() => {
                                            setSelectedBusiness(b);
                                            setSearchTerm("");
                                            setActiveFilter("all");
                                        }}
                                        className="group relative flex flex-col justify-between p-5 rounded-2xl border border-gray-200 bg-white hover:border-[#FF1F2D] hover:shadow-md transition-all duration-150 cursor-pointer"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {b.logo_url ? (
                                                        <img
                                                            src={b.logo_url}
                                                            alt={b.name}
                                                            className="h-12 w-12 rounded-xl object-cover border border-gray-200 shrink-0"
                                                        />
                                                    ) : (
                                                        <div
                                                            className="h-12 w-12 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-xs text-base"
                                                            style={{ backgroundColor: b.primary_color || "#FF1F2D" }}
                                                        >
                                                            {initials(b.name)}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <h3 className="font-bold text-gray-900 group-hover:text-[#FF1F2D] text-base truncate transition-colors">
                                                            {b.name}
                                                        </h3>
                                                        <p className="text-xs text-gray-400 truncate mt-0.5">
                                                            {b.reward_target || 10} sellos · {b.reward_description || "Beneficio"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                    b.active !== false ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-100 text-gray-500"
                                                }`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${b.active !== false ? "bg-emerald-500" : "bg-gray-400"}`} />
                                                    {b.active !== false ? "Activo" : "Inactivo"}
                                                </span>
                                            </div>

                                            <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs">
                                                <span className="font-semibold text-gray-500">
                                                    Clientes registrados:
                                                </span>
                                                <span className="font-bold text-gray-900 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
                                                    {totalClients} {totalClients === 1 ? "cliente" : "clientes"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-3 flex items-center justify-between text-xs font-semibold text-[#FF1F2D]">
                                            <span>Ver clientes del comercio</span>
                                            <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                /* VISTA 2: CLIENTES DEL NEGOCIO SELECCIONADO */
                <div>
                    {/* Botón Volver a negocios */}
                    {!initialBusinessId && (
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedBusiness(null);
                                setSearchTerm("");
                            }}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#FF1F2D] transition-colors mb-5 group cursor-pointer"
                        >
                            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                            <span>← Volver a negocios</span>
                        </button>
                    )}

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-3">
                                {currentBusiness.logo_url && (
                                    <img
                                        src={currentBusiness.logo_url}
                                        alt={currentBusiness.name}
                                        className="h-10 w-10 rounded-xl object-cover border border-gray-200 shadow-2xs"
                                    />
                                )}
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                                        Clientes de {currentBusiness.name}
                                    </h1>
                                    <p className="text-gray-500 text-xs sm:text-sm mt-0.5 font-medium">
                                        Gestiona tu base de clientes y sella manualmente aquellos sin batería.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2.5 items-center flex-wrap">
                            {!merchantMode && (
                                <button
                                    onClick={() => setIsEditMode(!isEditMode)}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-xs border ${
                                        isEditMode
                                            ? 'bg-gray-900 text-white border-gray-900 ring-2 ring-gray-900 ring-offset-1'
                                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <Settings size={15} className={isEditMode ? "animate-spin-slow" : ""} />
                                    {isEditMode ? 'Editando...' : 'Modo Edición'}
                                </button>
                            )}
                            <button
                                onClick={fetchCustomers}
                                className="bg-white border border-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 hover:bg-gray-50 transition shadow-xs"
                            >
                                <RefreshCcw size={15} className={isLoading ? "animate-spin" : ""} />
                                Refrescar
                            </button>
                            <a
                                href={`/t/${currentBusiness.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 hover:bg-blue-700 transition shadow-xs"
                            >
                                <UserPlus size={15} /> Alta cliente
                            </a>
                        </div>
                    </div>

                    {loadError && (
                        <div role="alert" className="mb-4 p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-medium">
                            {loadError} <button onClick={fetchCustomers} className="underline font-semibold ml-1">Reintentar</button>
                        </div>
                    )}

                    {/* Toolbar de Filtros y Búsqueda (sin marco de tarjeta) */}
                    <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <Search size={16} />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar por ID de cliente (ej. 15001), nombre o teléfono..."
                                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#FF1F2D] focus:border-[#FF1F2D] outline-none transition text-xs sm:text-sm text-gray-900 font-medium"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Botones de filtrado por semáforo */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setActiveFilter("all")}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                                    activeFilter === "all"
                                        ? "bg-gray-900 text-white shadow-xs"
                                        : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
                                }`}
                            >
                                Todos ({counts.all})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter("active")}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                                    activeFilter === "active"
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Nuevos / Activos ({counts.active})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter("risk")}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                                    activeFilter === "risk"
                                        ? "bg-slate-700 text-white shadow-xs"
                                        : "border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                                }`}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                Riesgo ({counts.risk})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter("inactive")}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                                    activeFilter === "inactive"
                                        ? "bg-rose-600 text-white shadow-xs"
                                        : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                }`}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                Inactivos ({counts.inactive})
                            </button>
                        </div>
                    </div>

                    {/* Tabla Full-Width con scroll horizontal y padding compacto py-2 */}
                    <div className="overflow-x-auto w-full border-t border-b border-gray-200">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/70 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-200">
                                    <th className="px-4 py-2 font-bold whitespace-nowrap">CÓDIGO</th>
                                    <th className="px-4 py-2 font-bold whitespace-nowrap">CLIENTE</th>
                                    <th className="px-4 py-2 font-bold whitespace-nowrap">PROMOS WHATSAPP</th>
                                    <th className="px-4 py-2 font-bold whitespace-nowrap">CUMPLEAÑOS</th>
                                    <th className="px-4 py-2 font-bold whitespace-nowrap">PROGRESO</th>
                                    <th className="px-4 py-2 font-bold whitespace-nowrap">ÚLTIMA VISITA</th>
                                    <th className="px-4 py-2 font-bold whitespace-nowrap text-right">ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {isLoading && businessCustomers.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-xs">
                                            <RefreshCcw size={20} className="animate-spin mx-auto mb-2 text-gray-300" />
                                            Cargando clientes de este comercio…
                                        </td>
                                    </tr>
                                ) : filtered.map((c: any) => {
                                    const inactivity = getInactivityStatus(c.last_visit_at, c.created_at);
                                    return (
                                        <tr key={c.id} className="hover:bg-gray-50/70 transition group">
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                <span className="font-mono text-xs font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                                                    {String(c.unique_code || "").replace(/^CLI\s*-\s*/i, "").trim()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-2.5">
                                                    <div
                                                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${inactivity.bgColor} ${inactivity.borderColor} transition-colors`}
                                                        title={`Semáforo: ${inactivity.label} (${inactivity.badgeText})`}
                                                    >
                                                        <User size={13} className={inactivity.iconColor} strokeWidth={2.2} />
                                                    </div>
                                                    <div>
                                                        <div onClick={() => openCustomerHistory(c)} className="font-semibold text-gray-900 text-xs leading-tight cursor-pointer hover:underline hover:text-[#FF1F2D] hover:text-primary transition-colors">
                                                            {c.first_name} {c.last_name}
                                                        </div>
                                                        <div className="text-gray-400 text-[11px] font-medium leading-tight mt-0.5">
                                                            {c.phone || "Sin teléfono"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-xs font-semibold">
                                                <span className={c.whatsapp_marketing_opt_in === true ? "text-emerald-700" : "text-gray-400"}>
                                                    {c.whatsapp_marketing_opt_in === true ? "Autorizadas" : "No autorizadas"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600 font-medium">
                                                {c.birthdate || "-"}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                                        <div
                                                            className="h-full bg-blue-500 transition-all duration-300"
                                                            style={{ width: `${Math.min(100, (c.current_stamps / getTargetStamps(c)) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold text-gray-700">
                                                        {c.current_stamps}/{getTargetStamps(c)}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-medium mt-0.5 leading-tight">
                                                    {c.total_visits || 0} visitas totales
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-600 font-medium">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${inactivity.badgeClass}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${inactivity.dotColor}`} />
                                                        {c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString() : 'Sin visitas'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">({inactivity.badgeText})</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {isEditMode ? (
                                                        <button
                                                            onClick={() => setEditingCustomer({ ...c })}
                                                            className="inline-flex items-center justify-center gap-1 text-blue-700 text-xs font-bold bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-all"
                                                            title="Editar Cliente"
                                                        >
                                                            <Edit3 size={13} /> Editar
                                                        </button>
                                                    ) : stampSuccessId === c.id ? (
                                                        <span className="inline-flex items-center justify-center gap-1 text-green-700 text-xs font-bold bg-green-100 px-2.5 py-1 rounded-lg transition-all">
                                                            <CheckCircle2 size={13} /> ¡Agregado!
                                                        </span>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                onClick={() => handleTestTapLink(c.id)}
                                                                disabled={testLinkLoadingId === c.id}
                                                                className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50 px-2 py-1 rounded-lg text-xs font-semibold transition-colors"
                                                                title="Genera un enlace temporal que usa el flujo NFC real"
                                                            >
                                                                <Link2 size={13} /> {testLinkLoadingId === c.id ? '…' : 'Link prueba'}
                                                            </button>
                                                            {testLinks[c.id] && (
                                                                <a href={testLinks[c.id]} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-700 hover:underline">
                                                                    Abrir
                                                                </a>
                                                            )}
                                                            {c.current_stamps >= getTargetStamps(c) && (
                                                                <button
                                                                    onClick={() => handleRedeem(c.id)}
                                                                    disabled={redeemLoadingId === c.id}
                                                                    className="bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                                                                >
                                                                    {redeemLoadingId === c.id ? 'Canjeando…' : 'Canjear'}
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleManualStamp(c.id, c.current_stamps, getTargetStamps(c))}
                                                                disabled={c.current_stamps >= getTargetStamps(c)}
                                                                className="bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-gray-900 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                                                            >
                                                                +1 Manual
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {!isLoading && !loadError && filtered.length === 0 && (
                        <div className="py-12 text-center flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-2">
                                <Search size={24} />
                            </div>
                            <h3 className="text-base font-bold text-gray-900 mb-0.5">Sin clientes en este comercio</h3>
                            <p className="text-gray-500 text-xs font-medium max-w-sm">
                                Este comercio aún no tiene clientes afiliados o no hay coincidencias con la búsqueda actual.
                            </p>
                        </div>
                    )}
                </div>
            )}

            <UpgradeModal isOpen={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} title="Actualizá a Pro para ver el historial detallado de clientes" feature="customers" />
            {profileCustomer && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => setProfileCustomer(null)}>
                    <aside role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl border-l border-gray-200 overflow-hidden animate-in slide-in-from-right duration-200">
                        <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-gray-50 px-6 py-5">
                            <div className="min-w-0">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF1F2D]">Perfil del Cliente</span>
                                <h3 className="text-lg font-bold text-gray-900 truncate mt-0.5">{`${profileCustomer.first_name || ""} ${profileCustomer.last_name || ""}`.trim() || profileCustomer.phone || "Cliente"}</h3>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                    {profileCustomer.unique_code && (
                                        <span className="inline-flex items-center rounded-md bg-white border border-gray-200 px-2 py-0.5 font-mono text-[11px] font-bold text-gray-900">
                                            ID {String(profileCustomer.unique_code).replace(/^CLI\s*-\s*/i, "").trim()}
                                        </span>
                                    )}
                                    {profileCustomer.phone && (
                                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                                            <Phone size={12} /> {profileCustomer.phone}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button type="button" onClick={() => setProfileCustomer(null)} className="rounded-xl p-1.5 text-gray-500 hover:bg-white hover:text-gray-900 transition-colors cursor-pointer"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-5">
                            <div className="mb-4 flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5"><History size={14} className="text-[#FF1F2D]" /><span>Historial de movimientos</span></h4>
                                {!isCurrentBusinessFree && !historyLoading && <span className="text-[11px] font-semibold text-gray-500">{historyLogs.length} registros</span>}
                            </div>
                            {isCurrentBusinessFree ? (
                                <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50/80 to-white p-6 text-center shadow-xs">
                                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 border border-amber-200"><Lock size={22} /></div>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-2"><Sparkles size={11} /> Exclusivo Pro / Premium</span>
                                    <p className="text-sm font-bold text-gray-900 leading-snug">El historial detallado de clientes es una función exclusiva de los planes Pro y Premium</p>
                                    <button type="button" onClick={() => setUpgradeModalOpen(true)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF1F2D] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#E01522] transition-colors cursor-pointer"><Zap size={14} className="text-amber-300" /><span>Mejorar plan</span></button>
                                </div>
                            ) : historyLoading ? (
                                <div className="py-12 text-center"><Loader2 size={24} className="mx-auto animate-spin text-[#FF1F2D] mb-2" /><p className="text-xs font-semibold text-gray-500">Cargando historial...</p></div>
                            ) : historyLogs.length === 0 ? (
                                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center"><History size={28} className="mx-auto text-gray-300 mb-2" /><p className="text-sm font-semibold text-gray-900">Sin movimientos registrados</p></div>
                            ) : (
                                <div className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 space-y-4">
                                    {historyLogs.map((item: any) => {
                                        const isRedeem = item.method === "REDEEM";
                                        const isNfc = item.method === "NFC";
                                        const isQr = item.method === "QR";
                                        const d = new Date(item.created_at);
                                        const dateStr = d.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
                                        const timeStr = d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false });
                                        const registeredBy = item.metadata?.registered_by_email || null;
                                        return (
                                            <div key={item.id} className="relative">
                                                <span className={`absolute -left-6 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-2xs ${isRedeem ? "bg-red-50 text-[#FF1F2D]" : "bg-emerald-50 text-emerald-600"}`}>
                                                    {isRedeem ? <Gift size={12} /> : <Stamp size={12} />}
                                                </span>
                                                <div className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-2xs">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${isRedeem ? "bg-red-50 text-[#FF1F2D] border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
                                                            {isRedeem ? "Canje de premio" : "+1 Sello"}
                                                        </span>
                                                        <span className="text-[11px] text-gray-500 shrink-0"><strong className="text-gray-900">{dateStr}</strong> · {timeStr} hs</span>
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600">
                                                        <span className="inline-flex items-center gap-1 font-medium">
                                                            {isNfc ? <><Smartphone size={12} className="text-sky-600" /> NFC / Autoservicio</> : isQr ? <><QrCode size={12} className="text-[#FF1F2D]" /> Escaneo QR</> : <><Edit3 size={12} /> Registro manual</>}
                                                        </span>
                                                        {registeredBy && <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 border border-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600 truncate"><User size={10} /> {registeredBy}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            )}
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

                                        // Limpieza preventiva (si no hay CASCADE configurado estricto).
                                        // automation_events se borra solo por su FK ON DELETE CASCADE.
                                        await supabase.from('stamp_logs').delete().eq('customer_id', editingCustomer.id);

                                        const { error } = await supabase.from('customers').delete().eq('id', editingCustomer.id).eq('business_id', editingCustomer.business_id);
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
                                        }).eq('id', editingCustomer.id).eq('business_id', editingCustomer.business_id);

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
