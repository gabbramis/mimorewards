"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Search, Plus, CheckCircle2, UserPlus, RefreshCcw, Settings, Edit3, X,
    Minus, Trash2, Link2, User, ArrowLeft, Store, ChevronRight, Loader2,
    History, Stamp, Gift, Smartphone, QrCode, Lock, Sparkles, Zap, Phone
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
            borderColor: "border border-red-500/40",
            bgColor: "bg-red-500/10",
            iconColor: "text-red-400",
            badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
            dotColor: "bg-red-400",
        };
    }
    const diffDays = Math.max(0, Math.floor((Date.now() - new Date(visitDate).getTime()) / (1000 * 60 * 60 * 24)));
    if (diffDays <= 7) {
        return {
            status: "active",
            label: "Activo (0-7d)",
            badgeText: diffDays === 0 ? "Hoy" : diffDays === 1 ? "Ayer" : `Hace ${diffDays}d`,
            borderColor: "border border-emerald-500/40",
            bgColor: "bg-emerald-500/10",
            iconColor: "text-emerald-400",
            badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            dotColor: "bg-emerald-400",
        };
    } else if (diffDays <= 24) {
        return {
            status: "risk",
            label: "Riesgo (8-24d)",
            badgeText: `Hace ${diffDays}d`,
            borderColor: "border border-zinc-700",
            bgColor: "bg-zinc-950",
            iconColor: "text-zinc-400",
            badgeClass: "bg-zinc-950 text-zinc-400 border-zinc-800",
            dotColor: "bg-zinc-400",
        };
    } else {
        return {
            status: "inactive",
            label: "Inactivo (+25d)",
            badgeText: `Hace ${diffDays}d`,
            borderColor: "border border-red-500/40",
            bgColor: "bg-red-500/10",
            iconColor: "text-red-400",
            badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
            dotColor: "bg-red-400",
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

    const customerCountsByBusiness = useMemo(() => {
        const counts = new Map<string, number>();
        customers.forEach((c: any) => {
            if (c.business_id) {
                counts.set(c.business_id, (counts.get(c.business_id) || 0) + 1);
            }
        });
        return counts;
    }, [customers]);

    const filteredBusinesses = useMemo(() => {
        const query = businessSearchTerm.trim().toLowerCase();
        if (!query) return businesses;
        return businesses.filter(b => b.name?.toLowerCase().includes(query));
    }, [businesses, businessSearchTerm]);

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

    const businessCustomers = useMemo(() => {
        if (!currentBusiness) return [];
        return customers.filter((c: any) => c.business_id === currentBusiness.id);
    }, [customers, currentBusiness]);

    const handleManualStamp = async (id: string, currentStamps: number, targetStamps: number) => {
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

            if (res.status === 504 || res.status === 500 || res.status >= 500) {
                alert("El servidor está despertando, intenta de nuevo");
                await fetchCustomers();
                setStampSuccessId(null);
                showToast("El servidor está despertando, intenta de nuevo.");
                return;
            }

            const payload = await res.json().catch(() => ({}));
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
            console.error("Error en handleManualStamp:", err);
            alert("El servidor está despertando, intenta de nuevo");
            await fetchCustomers();
            setStampSuccessId(null);
            showToast("El servidor está despertando, intenta de nuevo.");
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
        <div className="w-full max-w-7xl mx-auto font-sans">
            {toastMessage && (
                <div className="fixed top-4 right-4 bg-zinc-900 border border-zinc-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium z-50 flex items-center gap-2 animate-in slide-in-from-top-2">
                    <CheckCircle2 className="text-emerald-400 w-4 h-4" />
                    {toastMessage}
                </div>
            )}

            {/* VISTA 1: LISTA / GRILLA DE NEGOCIOS */}
            {!currentBusiness ? (
                <div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">Directorio de Clientes</h1>
                            <p className="text-zinc-400 text-sm mt-1.5">
                                Seleccioná un comercio para ver y gestionar su base de clientes.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="relative w-full sm:w-64">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    value={businessSearchTerm}
                                    onChange={(e) => setBusinessSearchTerm(e.target.value)}
                                    placeholder="Buscar comercio…"
                                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl focus:ring-1 focus:ring-white focus:border-white outline-none transition text-sm text-white placeholder:text-zinc-500"
                                />
                            </div>
                            <button
                                onClick={() => { fetchBusinesses(); fetchCustomers(); }}
                                className="bg-zinc-900 border border-zinc-800 text-zinc-200 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
                                title="Actualizar datos"
                            >
                                <RefreshCcw size={16} className={isLoadingBusinesses ? "animate-spin" : ""} />
                            </button>
                        </div>
                    </div>

                    {isLoadingBusinesses ? (
                        <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
                            <Loader2 size={28} className="animate-spin mb-3 text-white" />
                            <p className="text-sm font-medium">Cargando comercios…</p>
                        </div>
                    ) : businesses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 px-6 py-20 text-center">
                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400">
                                <Store size={32} strokeWidth={1.8} />
                            </div>
                            <h2 className="text-lg font-semibold text-white">No hay comercios registrados</h2>
                            <p className="mt-1 text-sm text-zinc-400 max-w-sm">
                                Creá tu primer comercio para poder asociar y gestionar clientes.
                            </p>
                        </div>
                    ) : filteredBusinesses.length === 0 ? (
                        <div className="flex flex-col items-center py-16 text-center text-zinc-400">
                            <Search size={32} className="mb-2 text-zinc-500" />
                            <p className="font-semibold text-white">Sin resultados para &ldquo;{businessSearchTerm}&rdquo;</p>
                            <button onClick={() => setBusinessSearchTerm("")} className="mt-2 text-xs font-medium text-zinc-400 hover:text-white underline">
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
                                        className="group relative flex flex-col justify-between p-5 rounded-2xl border border-zinc-800 bg-zinc-900 hover:border-zinc-700 transition-all duration-150 cursor-pointer"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {b.logo_url ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={b.logo_url}
                                                            alt={b.name}
                                                            className="h-12 w-12 rounded-xl object-cover border border-zinc-800 shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="h-12 w-12 rounded-xl flex items-center justify-center font-semibold text-white bg-zinc-950 border border-zinc-800 shrink-0 text-base">
                                                            {initials(b.name)}
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <h3 className="font-semibold text-white text-base truncate transition-colors">
                                                            {b.name}
                                                        </h3>
                                                        <p className="text-xs text-zinc-400 truncate mt-0.5">
                                                            {b.reward_target || 10} sellos · {b.reward_description || "Beneficio"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                                    b.active !== false ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-950 text-zinc-500 border-zinc-800"
                                                }`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${b.active !== false ? "bg-emerald-400" : "bg-zinc-500"}`} />
                                                    {b.active !== false ? "Activo" : "Inactivo"}
                                                </span>
                                            </div>

                                            <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs">
                                                <span className="font-medium text-zinc-400">
                                                    Clientes registrados:
                                                </span>
                                                <span className="font-semibold text-white bg-zinc-950 border border-zinc-800 px-2.5 py-1 rounded-lg">
                                                    {totalClients} {totalClients === 1 ? "cliente" : "clientes"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-3 flex items-center justify-between text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">
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
                    {!initialBusinessId && (
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedBusiness(null);
                                setSearchTerm("");
                            }}
                            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors mb-5 group cursor-pointer"
                        >
                            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
                            <span>← Volver a negocios</span>
                        </button>
                    )}

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <div className="flex items-center gap-3">
                                {currentBusiness.logo_url && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={currentBusiness.logo_url}
                                        alt={currentBusiness.name}
                                        className="h-10 w-10 rounded-xl object-cover border border-zinc-800"
                                    />
                                )}
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                                        Clientes de {currentBusiness.name}
                                    </h1>
                                    <p className="text-zinc-400 text-xs sm:text-sm mt-0.5">
                                        Gestioná la base de clientes y otorgá sellos o canjes manuales.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2.5 items-center flex-wrap">
                            {!merchantMode && (
                                <button
                                    onClick={() => setIsEditMode(!isEditMode)}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition border cursor-pointer ${
                                        isEditMode
                                            ? 'bg-white text-black border-white'
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800 hover:text-white'
                                    }`}
                                >
                                    <Settings size={15} />
                                    {isEditMode ? 'Editando...' : 'Modo Edición'}
                                </button>
                            )}
                            <button
                                onClick={fetchCustomers}
                                className="bg-zinc-900 border border-zinc-800 text-zinc-200 px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
                            >
                                <RefreshCcw size={15} className={isLoading ? "animate-spin" : ""} />
                                Refrescar
                            </button>
                            <a
                                href={`/t/${currentBusiness.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-white text-black hover:bg-gray-200 px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition"
                            >
                                <UserPlus size={15} /> Alta cliente
                            </a>
                        </div>
                    </div>

                    {loadError && (
                        <div role="alert" className="mb-4 p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-medium">
                            {loadError} <button onClick={fetchCustomers} className="underline font-semibold ml-1">Reintentar</button>
                        </div>
                    )}

                    {/* Toolbar de Filtros y Búsqueda */}
                    <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                                <Search size={16} />
                            </div>
                            <input
                                type="text"
                                placeholder="Buscar por ID de cliente (ej. 15001), nombre o teléfono..."
                                className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl focus:ring-1 focus:ring-white focus:border-white outline-none transition text-xs sm:text-sm text-white placeholder:text-zinc-500"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setActiveFilter("all")}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                                    activeFilter === "all"
                                        ? "bg-white text-black font-semibold"
                                        : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                                }`}
                            >
                                Todos ({counts.all})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter("active")}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                                    activeFilter === "active"
                                        ? "bg-white text-black font-semibold"
                                        : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                                }`}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Nuevos / Activos ({counts.active})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter("risk")}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                                    activeFilter === "risk"
                                        ? "bg-white text-black font-semibold"
                                        : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                                }`}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                                Riesgo ({counts.risk})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter("inactive")}
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                                    activeFilter === "inactive"
                                        ? "bg-white text-black font-semibold"
                                        : "border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                                }`}
                            >
                                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                Inactivos ({counts.inactive})
                            </button>
                        </div>
                    </div>

                    {/* Tabla de Clientes */}
                    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse min-w-[780px]">
                                <thead>
                                    <tr className="bg-zinc-950 text-zinc-400 text-[11px] uppercase tracking-wider border-b border-zinc-800">
                                        <th className="px-4 py-3 font-medium whitespace-nowrap">CÓDIGO</th>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap">CLIENTE</th>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap">PROMOS WHATSAPP</th>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap">CUMPLEAÑOS</th>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap">PROGRESO</th>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap">ÚLTIMA VISITA</th>
                                        <th className="px-4 py-3 font-medium whitespace-nowrap text-right">ACCIONES</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/50">
                                    {isLoading && businessCustomers.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-12 text-center text-zinc-400 text-xs">
                                                <RefreshCcw size={20} className="animate-spin mx-auto mb-2 text-zinc-500" />
                                                Cargando clientes de este comercio…
                                            </td>
                                        </tr>
                                    ) : filtered.map((c: any) => {
                                        const inactivity = getInactivityStatus(c.last_visit_at, c.created_at);
                                        return (
                                            <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition group">
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="font-mono text-xs font-medium bg-zinc-950 text-zinc-200 px-2 py-0.5 rounded border border-zinc-800">
                                                        {String(c.unique_code || "").replace(/^CLI\s*-\s*/i, "").trim()}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-2.5">
                                                        <div
                                                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${inactivity.bgColor} ${inactivity.borderColor} transition-colors`}
                                                            title={`Semáforo: ${inactivity.label} (${inactivity.badgeText})`}
                                                        >
                                                            <User size={13} className={inactivity.iconColor} strokeWidth={2.2} />
                                                        </div>
                                                        <div>
                                                            <div onClick={() => openCustomerHistory(c)} className="font-semibold text-white text-xs leading-tight cursor-pointer hover:underline transition-colors">
                                                                {c.first_name} {c.last_name}
                                                            </div>
                                                            <div className="text-zinc-500 text-[11px] leading-tight mt-0.5">
                                                                {c.phone || "Sin teléfono"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs font-medium">
                                                    <span className={c.whatsapp_marketing_opt_in === true ? "text-emerald-400" : "text-zinc-500"}>
                                                        {c.whatsapp_marketing_opt_in === true ? "Autorizadas" : "No autorizadas"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-400">
                                                    {c.birthdate || "-"}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-16 h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                                                            <div
                                                                className="h-full bg-white transition-all duration-300"
                                                                style={{ width: `${Math.min(100, (c.current_stamps / getTargetStamps(c)) * 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-xs font-semibold text-white">
                                                            {c.current_stamps}/{getTargetStamps(c)}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-zinc-500 mt-0.5 leading-tight">
                                                        {c.total_visits || 0} visitas totales
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-400">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${inactivity.badgeClass}`}>
                                                            <span className={`h-1.5 w-1.5 rounded-full ${inactivity.dotColor}`} />
                                                            {c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString() : 'Sin visitas'}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-500">({inactivity.badgeText})</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {isEditMode ? (
                                                            <button
                                                                onClick={() => setEditingCustomer({ ...c })}
                                                                className="inline-flex items-center justify-center gap-1 text-zinc-200 text-xs font-medium bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                                                title="Editar Cliente"
                                                            >
                                                                <Edit3 size={13} /> Editar
                                                            </button>
                                                        ) : stampSuccessId === c.id ? (
                                                            <span className="inline-flex items-center justify-center gap-1 text-emerald-400 text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg transition-all">
                                                                <CheckCircle2 size={13} /> ¡Agregado!
                                                            </span>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5">
                                                                <button
                                                                    onClick={() => handleTestTapLink(c.id)}
                                                                    disabled={testLinkLoadingId === c.id}
                                                                    className="inline-flex items-center gap-1 bg-zinc-950 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white disabled:opacity-50 px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                                                                    title="Genera un enlace temporal que usa el flujo NFC real"
                                                                >
                                                                    <Link2 size={13} /> {testLinkLoadingId === c.id ? '…' : 'Link prueba'}
                                                                </button>
                                                                {testLinks[c.id] && (
                                                                    <a href={testLinks[c.id]} target="_blank" rel="noreferrer" className="text-xs font-medium text-white hover:underline">
                                                                        Abrir
                                                                    </a>
                                                                )}
                                                                {c.current_stamps >= getTargetStamps(c) && (
                                                                    <button
                                                                        onClick={() => handleRedeem(c.id)}
                                                                        disabled={redeemLoadingId === c.id}
                                                                        className="bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-50 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                                                    >
                                                                        {redeemLoadingId === c.id ? 'Canjeando…' : 'Canjear'}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => handleManualStamp(c.id, c.current_stamps, getTargetStamps(c))}
                                                                    disabled={c.current_stamps >= getTargetStamps(c)}
                                                                    className="bg-white text-black hover:bg-gray-200 disabled:opacity-30 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
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
                    </div>

                    {!isLoading && !loadError && filtered.length === 0 && (
                        <div className="py-12 text-center flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-400 mb-2">
                                <Search size={24} />
                            </div>
                            <h3 className="text-base font-semibold text-white mb-0.5">Sin clientes en este comercio</h3>
                            <p className="text-zinc-400 text-xs max-w-sm">
                                Este comercio aún no tiene clientes afiliados o no hay coincidencias con la búsqueda actual.
                            </p>
                        </div>
                    )}
                </div>
            )}

            <UpgradeModal isOpen={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} title="Actualizá a Pro para ver el historial detallado de clientes" feature="customers" />
            {profileCustomer && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs animate-in fade-in duration-200" onClick={() => setProfileCustomer(null)}>
                    <aside role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="relative flex h-full w-full sm:max-w-md flex-col bg-zinc-900 border-l border-zinc-800 overflow-hidden animate-in slide-in-from-right duration-200">
                        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-6 py-5">
                            <div className="min-w-0">
                                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Perfil del Cliente</span>
                                <h3 className="text-lg font-semibold text-white truncate mt-0.5">{`${profileCustomer.first_name || ""} ${profileCustomer.last_name || ""}`.trim() || profileCustomer.phone || "Cliente"}</h3>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                                    {profileCustomer.unique_code && (
                                        <span className="inline-flex items-center rounded-md bg-zinc-900 border border-zinc-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
                                            ID {String(profileCustomer.unique_code).replace(/^CLI\s*-\s*/i, "").trim()}
                                        </span>
                                    )}
                                    {profileCustomer.phone && (
                                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                                            <Phone size={12} /> {profileCustomer.phone}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button type="button" onClick={() => setProfileCustomer(null)} className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors cursor-pointer"><X size={18} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-5">
                            <div className="mb-4 flex items-center justify-between">
                                <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-1.5"><History size={14} className="text-zinc-400" /><span>Historial de movimientos</span></h4>
                                {!isCurrentBusinessFree && !historyLoading && <span className="text-[11px] font-medium text-zinc-500">{historyLogs.length} registros</span>}
                            </div>
                            {isCurrentBusinessFree ? (
                                <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
                                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-zinc-300 border border-zinc-800"><Lock size={20} /></div>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-300 mb-2"><Sparkles size={11} /> Exclusivo Pro / Premium</span>
                                    <p className="text-sm font-semibold text-white leading-snug">El historial detallado de clientes es una función exclusiva de los planes Pro y Premium</p>
                                    <button type="button" onClick={() => setUpgradeModalOpen(true)} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black hover:bg-gray-200 transition-colors cursor-pointer"><Zap size={14} /><span>Mejorar plan</span></button>
                                </div>
                            ) : historyLoading ? (
                                <div className="py-12 text-center"><Loader2 size={24} className="mx-auto animate-spin text-white mb-2" /><p className="text-xs font-medium text-zinc-400">Cargando historial...</p></div>
                            ) : historyLogs.length === 0 ? (
                                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center"><History size={28} className="mx-auto text-zinc-500 mb-2" /><p className="text-sm font-semibold text-white">Sin movimientos registrados</p></div>
                            ) : (
                                <div className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-zinc-800 space-y-4">
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
                                                <span className={`absolute -left-6 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 ${isRedeem ? "text-amber-400" : "text-emerald-400"}`}>
                                                    {isRedeem ? <Gift size={12} /> : <Stamp size={12} />}
                                                </span>
                                                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${isRedeem ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
                                                            {isRedeem ? "Canje de premio" : "+1 Sello"}
                                                        </span>
                                                        <span className="text-[11px] text-zinc-400 shrink-0"><strong className="text-white font-semibold">{dateStr}</strong> · {timeStr} hs</span>
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                                                        <span className="inline-flex items-center gap-1 font-medium">
                                                            {isNfc ? <><Smartphone size={12} className="text-zinc-300" /> NFC / Autoservicio</> : isQr ? <><QrCode size={12} className="text-zinc-300" /> Escaneo QR</> : <><Edit3 size={12} /> Registro manual</>}
                                                        </span>
                                                        {registeredBy && <span className="inline-flex items-center gap-1 rounded-md bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 truncate"><User size={10} /> {registeredBy}</span>}
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
                <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
                            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Edit3 className="w-5 h-5 text-zinc-400" /> Editar Cliente
                            </h2>
                            <button onClick={() => setEditingCustomer(null)} className="text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg p-1.5 transition-colors border border-zinc-800 cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Nombre</label>
                                    <input
                                        type="text"
                                        value={editingCustomer.first_name || ''}
                                        onChange={e => setEditingCustomer({ ...editingCustomer, first_name: e.target.value })}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-white focus:ring-1 focus:ring-white outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Apellido</label>
                                    <input
                                        type="text"
                                        value={editingCustomer.last_name || ''}
                                        onChange={e => setEditingCustomer({ ...editingCustomer, last_name: e.target.value })}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-white focus:ring-1 focus:ring-white outline-none transition"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Teléfono (WhatsApp)</label>
                                <input
                                    type="tel"
                                    value={editingCustomer.phone || ''}
                                    onChange={e => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-white focus:ring-1 focus:ring-white outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Fecha de Nacimiento</label>
                                <input
                                    type="date"
                                    value={editingCustomer.birthdate || ''}
                                    onChange={e => setEditingCustomer({ ...editingCustomer, birthdate: e.target.value })}
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:border-white focus:ring-1 focus:ring-white outline-none transition"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Ajuste de Sellos (Manual)</label>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setEditingCustomer({ ...editingCustomer, current_stamps: Math.max(0, (editingCustomer.current_stamps || 0) - 1) })}
                                        className="bg-zinc-950 hover:bg-zinc-800 text-zinc-200 p-2.5 rounded-lg transition-colors border border-zinc-800 cursor-pointer"
                                    >
                                        <Minus className="w-5 h-5" />
                                    </button>
                                    <div className="w-16 text-center font-semibold text-xl text-white bg-zinc-950 border border-zinc-800 py-1.5 rounded-xl">
                                        {editingCustomer.current_stamps || 0}
                                    </div>
                                    <button
                                        onClick={() => setEditingCustomer({ ...editingCustomer, current_stamps: Math.min(10, (editingCustomer.current_stamps || 0) + 1) })}
                                        className="bg-zinc-950 hover:bg-zinc-800 text-zinc-200 p-2.5 rounded-lg transition-colors border border-zinc-800 cursor-pointer"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
                            <button
                                onClick={async () => {
                                    if (confirm('¿Seguro que deseas eliminar este cliente permanentemente?')) {
                                        const prevCustomers = [...customers];
                                        setCustomers(prevCustomers.filter(c => c.id !== editingCustomer.id));
                                        setEditingCustomer(null);

                                        await supabase.from('stamp_logs').delete().eq('customer_id', editingCustomer.id);

                                        const { error } = await supabase.from('customers').delete().eq('id', editingCustomer.id).eq('business_id', editingCustomer.business_id);
                                        if (error) {
                                            setCustomers(prevCustomers);
                                            alert("Error al eliminar");
                                        } else {
                                            showToast('Cliente eliminado con éxito.');
                                            router.refresh();
                                        }
                                    }
                                }}
                                className="text-red-400 hover:text-red-300 text-sm font-medium flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-red-500/10 transition cursor-pointer"
                            >
                                <Trash2 className="w-4 h-4" /> Eliminar
                            </button>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditingCustomer(null)}
                                    className="px-4 py-2 font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 hover:text-white transition cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={async () => {
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

                                            setCustomers(customers.map(c => c.id === editingCustomer.id ? editingCustomer : c));
                                            setEditingCustomer(null);
                                            showToast('Datos del cliente guardados.');
                                            router.refresh();
                                        } else {
                                            alert('Error al guardar: ' + error?.message);
                                        }
                                    }}
                                    className="px-4 py-2 font-semibold text-black bg-white rounded-xl hover:bg-gray-200 transition cursor-pointer"
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
