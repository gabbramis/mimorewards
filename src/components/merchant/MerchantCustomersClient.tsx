"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Users,
  User,
  Search,
  Plus,
  Stamp,
  Gift,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Check,
  RefreshCw,
  Smartphone,
  Lock,
  Zap,
  History,
  Edit3,
  QrCode,
  Phone,
  Calendar,
} from "lucide-react";
import { useBusiness, isPlanFree } from "@/contexts/BusinessContext";
import UpgradeModal from "./UpgradeModal";
import { formatMerchantDate } from "@/lib/merchant-dates";
import { createClient } from "@/lib/supabase/client";

export interface CustomerItem {
  id: string;
  unique_code: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  current_stamps: number;
  total_visits: number;
  last_visit_at: string | null;
  created_at: string;
}

export interface CustomerHistoryMovement {
  id: string;
  customer_id: string;
  business_id: string;
  method: string;
  stamps_added?: number | null;
  metadata?: {
    registered_by_email?: string | null;
    registered_by_id?: string | null;
    redemption_id?: string | null;
    [key: string]: unknown;
  } | null;
  created_at: string;
}

export type InactivityStatus = {
  status: "active" | "risk" | "inactive";
  days: number;
  label: string;
  borderColor: string;
  bgColor: string;
  iconColor: string;
  badgeClass: string;
  badgeText: string;
  dotColor: string;
};

export function getCustomerInactivityStatus(
  lastVisitAt?: string | null,
  createdAt?: string | null,
  nowMs: number = Date.now()
): InactivityStatus {
  const visitDate = lastVisitAt || createdAt;
  if (!visitDate) {
    return {
      status: "inactive",
      days: 999,
      label: "Inactivos",
      borderColor: "border-2 border-red-500",
      bgColor: "bg-red-50",
      iconColor: "text-red-500",
      badgeClass: "bg-red-50 text-red-700 border border-red-200",
      badgeText: "Inactivo (+25 d)",
      dotColor: "bg-red-500",
    };
  }

  const lastMs = new Date(visitDate).getTime();
  const diffDays = Math.max(0, Math.floor((nowMs - lastMs) / (1000 * 60 * 60 * 24)));

  if (diffDays <= 7) {
    return {
      status: "active",
      days: diffDays,
      label: "Nuevos / Activos",
      borderColor: "border-2 border-emerald-500",
      bgColor: "bg-emerald-50",
      iconColor: "text-emerald-600",
      badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      badgeText: diffDays === 0 ? "Hoy (Activo)" : `Hace ${diffDays}d (Activo)`,
      dotColor: "bg-emerald-500",
    };
  } else if (diffDays <= 24) {
    return {
      status: "risk",
      days: diffDays,
      label: "Riesgo",
      borderColor: "border-2 border-slate-400",
      bgColor: "bg-slate-50",
      iconColor: "text-slate-600",
      badgeClass: "bg-slate-100 text-slate-700 border border-slate-300",
      badgeText: `Hace ${diffDays}d (Riesgo)`,
      dotColor: "bg-slate-400",
    };
  } else {
    return {
      status: "inactive",
      days: diffDays,
      label: "Inactivos",
      borderColor: "border-2 border-red-500",
      bgColor: "bg-red-50",
      iconColor: "text-red-500",
      badgeClass: "bg-red-50 text-red-700 border border-red-200",
      badgeText: `Hace ${diffDays}d (Inactivo)`,
      dotColor: "bg-red-500",
    };
  }
}

interface MerchantCustomersClientProps {
  referenceNow: number;
  businessId: string;
  initialCustomers: CustomerItem[];
  rewardTarget: number;
  rewardDescription: string;
  planType?: string | null;
}

function formatDate(dateStr: string | null) {
  return formatMerchantDate(dateStr);
}

function formatMovementDateAndTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const datePart = new Intl.DateTimeFormat("es-UY", {
      timeZone: "America/Montevideo",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
    const timePart = new Intl.DateTimeFormat("es-UY", {
      timeZone: "America/Montevideo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
    return { datePart, timePart: `${timePart} hs` };
  } catch {
    return { datePart: dateStr, timePart: "" };
  }
}

function formatNumericCode(code?: string | null): string {
  if (!code) return "";
  return String(code).replace(/^CLI\s*-\s*/i, "").trim();
}

export default function MerchantCustomersClient({
  referenceNow,
  businessId,
  initialCustomers,
  rewardTarget,
  rewardDescription,
  planType,
}: MerchantCustomersClientProps) {
  const { isFreePlan: contextIsFree } = useBusiness();
  const isFree = planType !== undefined ? isPlanFree(planType) : contextIsFree;

  const [customers, setCustomers] = useState<CustomerItem[]>(initialCustomers);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "risk" | "inactive" | "ready"
  >("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Slide-over / Sheet de Perfil e Historial del Cliente
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null);
  const [historyLogs, setHistoryLogs] = useState<CustomerHistoryMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const profileCustomer = useMemo(
    () => customers.find((c) => c.id === profileCustomerId) || null,
    [customers, profileCustomerId]
  );

  // Modal State (Operación manual)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [modalAction, setModalAction] = useState<"STAMP" | "REDEEM">("STAMP");
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const [now] = useState(referenceNow);

  const fetchCustomerHistory = useCallback(
    async (customerId: string) => {
      if (isFree) {
        setHistoryLogs([]);
        setHistoryLoading(false);
        setHistoryError(null);
        return;
      }

      setHistoryLoading(true);
      setHistoryError(null);

      try {
        // 1. Consulta a través del endpoint autenticado de comercio (usa service_role y verifica acceso)
        const res = await fetch(
          `/api/merchant/customers/${encodeURIComponent(customerId)}/history?businessId=${encodeURIComponent(businessId)}`,
          { cache: "no-store" }
        );

        if (res.ok) {
          const payload = await res.json();
          setHistoryLogs(Array.isArray(payload.logs) ? payload.logs : []);
          return;
        }

        // 2. Fallback directo a Supabase filtrando por customer_id y business_id
        const supabase = createClient();
        const { data, error } = await supabase
          .from("stamp_logs")
          .select("id, customer_id, business_id, method, stamps_added, metadata, created_at")
          .eq("customer_id", customerId)
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(200);

        if (error) throw error;
        setHistoryLogs((data as CustomerHistoryMovement[]) || []);
      } catch (err: any) {
        console.error("Error cargando historial del cliente:", err);
        setHistoryError("No pudimos cargar el historial de movimientos.");
      } finally {
        setHistoryLoading(false);
      }
    },
    [businessId, isFree]
  );

  useEffect(() => {
    if (profileCustomerId) {
      void fetchCustomerHistory(profileCustomerId);
    } else {
      setHistoryLogs([]);
      setHistoryError(null);
    }
  }, [profileCustomerId, fetchCustomerHistory]);

  // Cerrar Slide-over con Escape
  useEffect(() => {
    if (!profileCustomerId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileCustomerId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [profileCustomerId]);

  // Filtrado y segmentación rápida
  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return customers.filter((c) => {
      const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const rawCode = (c.unique_code || "").toLowerCase();
      const cleanCode = rawCode.replace(/^cli\s*-\s*/i, "");
      const cleanQuery = query.replace(/^cli\s*-\s*/i, "");

      const matchesCode =
        rawCode.includes(query) ||
        (cleanQuery.length > 0 && cleanCode.includes(cleanQuery));

      const matchesQuery =
        !query ||
        fullName.includes(query) ||
        phone.includes(query) ||
        matchesCode;

      if (!matchesQuery) return false;

      const semaforo = getCustomerInactivityStatus(c.last_visit_at, c.created_at, now);
      if (activeFilter === "active") {
        return semaforo.status === "active";
      }
      if (activeFilter === "risk") {
        return semaforo.status === "risk";
      }
      if (activeFilter === "inactive") {
        return semaforo.status === "inactive";
      }
      if (activeFilter === "ready") {
        return c.current_stamps >= rewardTarget;
      }
      return true;
    });
  }, [customers, searchQuery, activeFilter, rewardTarget, now]);

  // Contadores para chips
  const counts = useMemo(() => {
    let active = 0;
    let risk = 0;
    let inactive = 0;
    let ready = 0;

    customers.forEach((c) => {
      const semaforo = getCustomerInactivityStatus(c.last_visit_at, c.created_at, now);
      if (semaforo.status === "active") active++;
      else if (semaforo.status === "risk") risk++;
      else if (semaforo.status === "inactive") inactive++;

      if (c.current_stamps >= rewardTarget) ready++;
    });

    return {
      all: customers.length,
      active,
      risk,
      inactive,
      ready,
    };
  }, [customers, rewardTarget, now]);

  // Acción: Sumar Sello Manual
  const handleAddStamp = async (customerId: string, clientName: string) => {
    setActionLoadingId(customerId);
    try {
      const res = await fetch("/api/stamps/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: customerId,
          businessId,
          method: "MANUAL",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo sumar el sello.");
      }

      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === customerId) {
            return {
              ...c,
              current_stamps: data.newTotal,
              total_visits: (c.total_visits || 0) + 1,
              last_visit_at: new Date().toISOString(),
            };
          }
          return c;
        })
      );

      if (profileCustomerId === customerId && !isFree) {
        void fetchCustomerHistory(customerId);
      }

      showToast(
        `¡Sello acreditado a ${clientName}! Total: ${data.newTotal}/${rewardTarget}`,
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Error al sumar sello.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Acción: Canjear Premio Manual
  const handleRedeem = async (customerId: string, clientName: string) => {
    setActionLoadingId(customerId);
    try {
      const res = await fetch("/api/stamps/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: customerId,
          businessId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo realizar el canje.");
      }

      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === customerId) {
            return {
              ...c,
              current_stamps: 0,
              last_visit_at: new Date().toISOString(),
            };
          }
          return c;
        })
      );

      if (profileCustomerId === customerId && !isFree) {
        void fetchCustomerHistory(customerId);
      }

      showToast(
        `¡Recompensa entregada a ${clientName}! Saldo de sellos reiniciado.`,
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Error al canjear recompensa.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Autocomplete en modal
  const modalSearchResults = useMemo(() => {
    const q = modalSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 5);
    const cleanQ = q.replace(/^cli\s*-\s*/i, "");

    return customers
      .filter((c) => {
        const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        const rawCode = (c.unique_code || "").toLowerCase();
        const cleanCode = rawCode.replace(/^cli\s*-\s*/i, "");

        const matchesCode =
          rawCode.includes(q) ||
          (cleanQ.length > 0 && cleanCode.includes(cleanQ));

        return fullName.includes(q) || phone.includes(q) || matchesCode;
      })
      .slice(0, 6);
  }, [customers, modalSearch]);

  const selectedModalCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Ejecutar movimiento desde el modal
  const handleConfirmModalMovement = async () => {
    if (!selectedModalCustomer) return;
    setModalSubmitting(true);
    const clientName =
      `${selectedModalCustomer.first_name || ""} ${selectedModalCustomer.last_name || ""}`.trim() ||
      selectedModalCustomer.phone ||
      "Cliente";

    if (modalAction === "STAMP") {
      await handleAddStamp(selectedModalCustomer.id, clientName);
    } else {
      await handleRedeem(selectedModalCustomer.id, clientName);
    }

    setModalSubmitting(false);
    setModalOpen(false);
    setSelectedCustomerId(null);
    setModalSearch("");
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Actualizá a Pro para ver el historial y métricas de retención de tus clientes"
        description="El historial detallado de movimientos por cliente, el semáforo de inactividad, la fecha de última visita y las visitas totales son funciones exclusivas de los planes Pro y Premium."
        feature="customers"
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-4 right-4 sm:left-auto sm:max-w-sm sm:right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl border text-sm font-semibold transition-all ${
            toast.type === "success"
              ? "bg-white border-[#10B981] text-[#1F1F1F] shadow-[#10B981]/10"
              : "bg-white border-[#FF1F2D] text-[#1F1F1F] shadow-[#FF1F2D]/10"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={18} className="text-[#10B981] shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-[#FF1F2D] shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#737373]">
            CRM & Operación de Mostrador
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-[#1F1F1F]">
            Clientes
          </h2>
          <p className="text-xs text-[#737373] mt-0.5">
            Base de datos de fidelización y carga manual de sellos o canjes sin
            escáner.
          </p>
        </div>

        {/* Botón Principal: Registrar Movimiento Manual */}
        <button
          type="button"
          onClick={() => {
            setModalOpen(true);
            setSelectedCustomerId(null);
            setModalSearch("");
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#FF1F2D] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#E01522] transition-colors shrink-0"
        >
          <Plus size={16} />
          <span>+ Registrar movimiento manual</span>
        </button>
      </div>

      {/* Banner de Upgrade para Plan Gratis */}
      {isFree && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/50 p-4 sm:p-5 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  <Lock size={10} />
                  PLAN INICIAL
                </span>
                <p className="text-xs sm:text-sm font-bold text-[#1F1F1F]">
                  Actualizá a Pro para ver el estado y métricas de retención de tus clientes
                </p>
              </div>
              <p className="text-xs text-[#737373] mt-0.5">
                Desbloqueá el historial detallado por cliente, el semáforo inteligente de inactividad y frecuencia de visitas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUpgradeModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F1F1F] px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-black transition-all shrink-0 cursor-pointer"
          >
            <Zap size={14} className="text-amber-400" />
            <span>Mejorar a Pro</span>
          </button>
        </div>
      )}

      {/* Card de Búsqueda y Filtros Rápidos */}
      <div className="rounded-2xl border border-[#D5CFC4] bg-white p-4 sm:p-5 shadow-xs space-y-4">
        {/* Buscador en tiempo real */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737373]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, teléfono o ID de cliente (ej. 15001)..."
            className="w-full rounded-xl border border-[#D5CFC4] bg-[#FFF9F5] py-2.5 pl-10 pr-4 text-xs text-[#1F1F1F] placeholder:text-[#737373] focus:border-[#FF1F2D] focus:bg-white focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#1F1F1F]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Chips de Filtros Rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === "all"
                ? "bg-[#1F1F1F] text-white shadow-xs"
                : "border border-[#D5CFC4] bg-white text-[#737373] hover:border-[#B8B1A4] hover:text-[#1F1F1F]"
            }`}
          >
            Todos ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("ready")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === "ready"
                ? "bg-[#FF1F2D] text-white shadow-xs"
                : "border border-[#FFD9DC] bg-[#FFF0F1] text-[#FF1F2D] hover:bg-[#FFE5E8]"
            }`}
          >
            <Gift size={12} />
            Listos para canjear ({counts.ready})
          </button>

          {isFree ? (
            <button
              type="button"
              onClick={() => setUpgradeModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold border border-amber-300 bg-amber-50/70 text-amber-800 hover:bg-amber-100 transition-all cursor-pointer"
              title="Actualizá a Pro para ver el semáforo de retención"
            >
              <Lock size={12} className="text-amber-600" />
              <span>Semáforo de retención</span>
              <span className="rounded-full bg-amber-200/60 px-1.5 py-0.2 text-[9px] font-black uppercase text-amber-800">
                PRO
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveFilter("active")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  activeFilter === "active"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                Nuevos / Activos ({counts.active})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("risk")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  activeFilter === "risk"
                    ? "bg-slate-700 text-white shadow-xs"
                    : "border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-slate-400 ring-2 ring-slate-200" />
                Riesgo ({counts.risk})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("inactive")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  activeFilter === "inactive"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-rose-500 ring-2 ring-rose-200" />
                Inactivos ({counts.inactive})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabla de Clientes */}
      <div className="rounded-2xl border border-[#D5CFC4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D5CFC4] bg-[#FFF9F5] text-[#737373]">
                <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px]">
                  Cliente
                </th>
                <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px]">
                  Progreso actual
                </th>
                {!isFree && (
                  <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px]">
                    Visitas totales
                  </th>
                )}
                {!isFree && (
                  <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px]">
                    Última visita
                  </th>
                )}
                <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px] text-right">
                  Acciones rápidas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5CFC4]">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => {
                  const clientName =
                    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
                    customer.phone ||
                    "Cliente";
                  const numericCode = formatNumericCode(customer.unique_code);
                  const stamps = customer.current_stamps || 0;
                  const isReady = stamps >= rewardTarget;
                  const percent = Math.min(
                    Math.round((stamps / rewardTarget) * 100),
                    100
                  );
                  const isLoading = actionLoadingId === customer.id;
                  const inactivity = getCustomerInactivityStatus(
                    customer.last_visit_at,
                    customer.created_at,
                    now
                  );

                  return (
                    <tr
                      key={customer.id}
                      className="hover:bg-[#FFF9F5] transition-colors"
                    >
                      {/* Cliente (Avatar + Nombre interactivo que abre el Slide-over de Perfil del Cliente) */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          {isFree ? (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] border border-[#E5E5E5] text-[#737373]">
                              <User size={16} strokeWidth={2} />
                            </div>
                          ) : (
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${inactivity.bgColor} ${inactivity.borderColor} transition-colors`}
                              title={`Semáforo: ${inactivity.label} (${inactivity.badgeText})`}
                            >
                              <User size={16} className={inactivity.iconColor} strokeWidth={2} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setProfileCustomerId(customer.id)}
                              title="Ver perfil e historial del cliente"
                              className="font-bold text-[#1F1F1F] leading-snug text-left cursor-pointer hover:underline hover:text-[#FF1F2D] hover:text-primary transition-colors"
                            >
                              {clientName}
                            </button>
                            <div className="flex items-center gap-2 text-[10px] text-[#737373] mt-0.5">
                              {customer.phone && <span>{customer.phone}</span>}
                              {numericCode && (
                                <span className="rounded bg-[#F5F5F5] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#525252]">
                                  {numericCode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Progreso (Sellos actuales) */}
                      <td className="py-4 px-5">
                        <div className="w-36 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span
                              className={
                                isReady ? "text-[#FF1F2D]" : "text-[#1F1F1F]"
                              }
                            >
                              {stamps} / {rewardTarget} sellos
                            </span>
                            {isReady && (
                              <span className="text-[10px] text-[#10B981] font-bold">
                                ¡Listo!
                              </span>
                            )}
                          </div>
                          <div className="h-2 w-full rounded-full bg-[#F5F5F5] overflow-hidden">
                            <div
                              style={{ width: `${percent}%` }}
                              className={`h-full rounded-full transition-all duration-300 ${
                                isReady ? "bg-[#10B981]" : "bg-[#FF1F2D]"
                              }`}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Visitas totales (Oculto en Free) */}
                      {!isFree && (
                        <td className="py-4 px-5 font-semibold text-[#1F1F1F]">
                          <span>{customer.total_visits || 1} visitas</span>
                        </td>
                      )}

                      {/* Última visita (Oculto en Free) */}
                      {!isFree && (
                        <td className="py-4 px-5 text-[#737373] whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1.5 text-xs font-medium text-[#1F1F1F]">
                              <Clock size={13} className="text-[#A3A3A3]" />
                              {formatDate(customer.last_visit_at)}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold w-fit ${inactivity.badgeClass}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${inactivity.dotColor}`}
                              />
                              {inactivity.badgeText}
                            </span>
                          </div>
                        </td>
                      )}

                      {/* Acciones Rápidas */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {/* Botón directo +1 Sello */}
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleAddStamp(customer.id, clientName)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D5CFC4] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F1F1F] hover:bg-[#FFF9F5] hover:border-[#B8B1A4] disabled:opacity-50 transition-all shadow-2xs"
                          >
                            <Stamp size={13} className="text-[#FF1F2D]" />
                            <span>+1 Sello</span>
                          </button>

                          {/* Botón Canjear Premio */}
                          <button
                            type="button"
                            disabled={!isReady || isLoading}
                            onClick={() => handleRedeem(customer.id, clientName)}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                              isReady
                                ? "bg-[#FF1F2D] text-white hover:bg-[#E01522] shadow-xs animate-pulse"
                                : "bg-[#F5F5F5] text-[#A3A3A3] cursor-not-allowed border border-[#E5E5E5]"
                            }`}
                            title={
                              isReady
                                ? "Canjear premio"
                                : `Faltan ${rewardTarget - stamps} sellos para canjear`
                            }
                          >
                            <Gift size={13} />
                            <span>Canjear premio</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isFree ? 3 : 5} className="py-12 text-center">
                    <Users size={32} className="mx-auto text-[#D4D4D4] mb-2" />
                    <p className="text-sm font-semibold text-[#1F1F1F]">
                      No se encontraron clientes
                    </p>
                    <p className="text-xs text-[#737373] mt-1">
                      {searchQuery
                        ? "Probá con otro término de búsqueda."
                        : "Los clientes registrados en tu local aparecerán aquí."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Fila o banner al final para Plan Gratis */}
        {isFree && (
          <div className="border-t border-[#D5CFC4] bg-amber-50/50 px-5 py-3 text-xs text-[#737373] flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-900 font-medium">
              <Lock size={13} className="text-amber-600 shrink-0" />
              <span>
                Actualizá a Pro para ver el estado y métricas de retención de tus clientes.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setUpgradeModalOpen(true)}
              className="text-xs font-bold text-[#FF1F2D] hover:underline shrink-0 cursor-pointer"
            >
              Mejorar a Pro →
            </button>
          </div>
        )}

        {/* Footer de resumen */}
        <div className="border-t border-[#D5CFC4] bg-[#FFF9F5] px-5 py-3 text-xs text-[#737373] flex flex-wrap gap-2 items-center justify-between">
          <span>
            Mostrando {filteredCustomers.length} de {customers.length} clientes
          </span>
          <span className="font-medium text-[#1F1F1F]">
            Meta activa: {rewardTarget} sellos = {rewardDescription}
          </span>
        </div>
      </div>

      {/* SLIDE-OVER / SHEET: Perfil del Cliente e Historial Detallado */}
      {profileCustomer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setProfileCustomerId(null)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-profile-title"
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl border-l border-[#D5CFC4] overflow-hidden animate-in slide-in-from-right duration-200"
          >
            {/* Cabecera del Slide-over */}
            <div className="flex items-start justify-between gap-3 border-b border-[#D5CFC4] bg-[#FFF9F5] px-6 py-5">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF1F2D]">
                  Perfil del Cliente
                </span>
                <h3
                  id="customer-profile-title"
                  className="text-lg font-bold text-[#1F1F1F] truncate mt-0.5"
                >
                  {`${profileCustomer.first_name || ""} ${profileCustomer.last_name || ""}`.trim() ||
                    profileCustomer.phone ||
                    "Cliente"}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#737373]">
                  {formatNumericCode(profileCustomer.unique_code) && (
                    <span className="inline-flex items-center rounded-md bg-white border border-[#D5CFC4] px-2 py-0.5 font-mono text-[11px] font-bold text-[#1F1F1F]">
                      ID {formatNumericCode(profileCustomer.unique_code)}
                    </span>
                  )}
                  {profileCustomer.phone && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#525252]">
                      <Phone size={12} className="text-[#737373]" />
                      {profileCustomer.phone}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileCustomerId(null)}
                aria-label="Cerrar perfil del cliente"
                className="rounded-xl p-1.5 text-[#737373] hover:bg-white hover:text-[#1F1F1F] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumen de Progreso del Cliente */}
            <div className="border-b border-[#D5CFC4] bg-white px-6 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#D5CFC4] bg-[#FFF9F5] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#737373]">
                    Sellos actuales
                  </span>
                  <p className="mt-1 text-base font-bold text-[#1F1F1F]">
                    {profileCustomer.current_stamps} / {rewardTarget}
                  </p>
                </div>
                <div className="rounded-xl border border-[#D5CFC4] bg-[#FFF9F5] p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#737373]">
                    Visitas registradas
                  </span>
                  <p className="mt-1 text-base font-bold text-[#1F1F1F]">
                    {isFree ? "—" : `${profileCustomer.total_visits || 1} visitas`}
                  </p>
                </div>
              </div>
            </div>

            {/* Cuerpo del Slide-over: Paywall vs Timeline de Movimientos */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#737373] flex items-center gap-1.5">
                  <History size={14} className="text-[#FF1F2D]" />
                  <span>Historial de movimientos</span>
                </h4>
                {!isFree && !historyLoading && (
                  <span className="text-[11px] font-semibold text-[#737373]">
                    {historyLogs.length}{" "}
                    {historyLogs.length === 1 ? "registro" : "registros"}
                  </span>
                )}
              </div>

              {isFree ? (
                /* Estado bloqueado (Paywall) para planes que NO son Pro o Premium */
                <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50/80 to-white p-6 text-center shadow-xs">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 border border-amber-200">
                    <Lock size={22} />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-2">
                    <Sparkles size={11} />
                    Exclusivo Pro / Premium
                  </span>
                  <p className="text-sm font-bold text-[#1F1F1F] leading-snug">
                    El historial detallado de clientes es una función exclusiva de los planes Pro y Premium
                  </p>
                  <p className="mt-1.5 text-xs text-[#737373] leading-relaxed">
                    Consultá cada sello acreditado, canjes de premios, fecha, hora exacta y operador que realizó el registro.
                  </p>
                  <button
                    type="button"
                    onClick={() => setUpgradeModalOpen(true)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF1F2D] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#E01522] transition-colors cursor-pointer"
                  >
                    <Zap size={14} className="text-amber-300" />
                    <span>Mejorar plan</span>
                  </button>
                </div>
              ) : historyLoading ? (
                <div className="py-12 text-center">
                  <RefreshCw
                    size={24}
                    className="mx-auto animate-spin text-[#FF1F2D] mb-2"
                  />
                  <p className="text-xs font-semibold text-[#737373]">
                    Cargando historial del cliente...
                  </p>
                </div>
              ) : historyError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
                  <p className="text-xs font-semibold text-red-700">
                    {historyError}
                  </p>
                  <button
                    type="button"
                    onClick={() => fetchCustomerHistory(profileCustomer.id)}
                    className="mt-2 text-xs font-bold text-[#FF1F2D] hover:underline"
                  >
                    Reintentar
                  </button>
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="rounded-2xl border border-[#D5CFC4] bg-[#FFF9F5] p-8 text-center">
                  <History size={28} className="mx-auto text-[#D4D4D4] mb-2" />
                  <p className="text-sm font-semibold text-[#1F1F1F]">
                    Sin movimientos registrados
                  </p>
                  <p className="text-xs text-[#737373] mt-1">
                    Los sellos y canjes de este cliente aparecerán en esta línea de tiempo.
                  </p>
                </div>
              ) : (
                /* Línea de tiempo (Timeline) ordenada cronológicamente (más reciente primero) */
                <div className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5E0D5] space-y-4">
                  {historyLogs.map((item) => {
                    const isRedeem = item.method === "REDEEM";
                    const isNfc = item.method === "NFC";
                    const isQr = item.method === "QR";
                    const stampsCount =
                      typeof item.stamps_added === "number" && item.stamps_added > 0
                        ? item.stamps_added
                        : 1;
                    const { datePart, timePart } = formatMovementDateAndTime(
                      item.created_at
                    );
                    const registeredBy =
                      item.metadata &&
                      typeof item.metadata.registered_by_email === "string"
                        ? item.metadata.registered_by_email
                        : null;

                    return (
                      <div key={item.id} className="relative">
                        {/* Nodo de la línea de tiempo */}
                        <span
                          className={`absolute -left-6 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-2xs ${
                            isRedeem
                              ? "bg-[#FFF0F1] text-[#FF1F2D]"
                              : "bg-[#ECFDF5] text-[#10B981]"
                          }`}
                        >
                          {isRedeem ? <Gift size={12} /> : <Stamp size={12} />}
                        </span>

                        <div className="rounded-2xl border border-[#D5CFC4] bg-white p-3.5 shadow-2xs">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                isRedeem
                                  ? "bg-[#FFF0F1] text-[#FF1F2D] border border-[#FFD9DC]"
                                  : "bg-[#ECFDF5] text-[#10B981] border border-[#A7F3D0]"
                              }`}
                            >
                              {isRedeem
                                ? "Canje de premio"
                                : `+${stampsCount} ${
                                    stampsCount === 1 ? "Sello" : "Sellos"
                                  }`}
                            </span>

                            <div className="text-right text-[11px] text-[#737373] shrink-0">
                              <span className="font-semibold text-[#1F1F1F]">
                                {datePart}
                              </span>
                              {timePart && (
                                <span className="ml-1 text-[#737373]">
                                  · {timePart}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#525252]">
                            <span className="inline-flex items-center gap-1 font-medium">
                              {isNfc ? (
                                <>
                                  <Smartphone size={12} className="text-[#0284C7]" />
                                  <span>NFC / Autoservicio</span>
                                </>
                              ) : isQr ? (
                                <>
                                  <QrCode size={12} className="text-[#FF1F2D]" />
                                  <span>Escaneo QR en caja</span>
                                </>
                              ) : (
                                <>
                                  <Edit3 size={12} className="text-[#737373]" />
                                  <span>Registro manual en panel</span>
                                </>
                              )}
                            </span>

                            {registeredBy && (
                              <span
                                className="inline-flex items-center gap-1 rounded-md bg-[#FFF9F5] border border-[#E5E0D5] px-2 py-0.5 text-[10px] font-medium text-[#525252] truncate max-w-full"
                                title={`Registrado por ${registeredBy}`}
                              >
                                <User size={10} className="text-[#737373] shrink-0" />
                                <span className="truncate">{registeredBy}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer del Slide-over */}
            <div className="border-t border-[#D5CFC4] bg-[#FFF9F5] px-6 py-3.5 flex items-center justify-between text-xs text-[#737373]">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />
                Alta: {formatDate(profileCustomer.created_at)}
              </span>
              <button
                type="button"
                onClick={() => setProfileCustomerId(null)}
                className="rounded-xl border border-[#D5CFC4] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1F1F1F] hover:bg-[#FFF9F5] transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MODAL: Registrar Movimiento Manual */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl border border-[#D5CFC4] bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#D5CFC4]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF1F2D]">
                  Operación Manual
                </span>
                <h3 className="text-lg font-bold text-[#1F1F1F]">
                  Registrar movimiento manual
                </h3>
                <p className="text-xs text-[#737373] mt-0.5">
                  Sumá sellos o canjeá premios sin necesidad de escáner.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Cerrar registro de movimiento"
                className="rounded-lg p-1 text-[#737373] hover:bg-[#FFF9F5] hover:text-[#1F1F1F]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-5 space-y-5">
              {/* Buscador de Cliente con Autocomplete */}
              <div>
                <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">
                  1. Seleccionar cliente
                </label>
                <div className="relative">
                  <Search
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737373]"
                  />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="Escribí nombre, teléfono o ID (ej. 15001)..."
                    className="w-full rounded-xl border border-[#D5CFC4] bg-[#FFF9F5] py-2.5 pl-9 pr-3 text-xs text-[#1F1F1F] placeholder:text-[#737373] focus:border-[#FF1F2D] focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Lista desplegable de clientes coincidentes */}
                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-[#D5CFC4] bg-white divide-y divide-[#D5CFC4]">
                  {modalSearchResults.map((c) => {
                    const isSelected = selectedCustomerId === c.id;
                    const cName =
                      `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
                      c.phone ||
                      "Cliente";
                    const cCode = formatNumericCode(c.unique_code);
                    const cInactivity = getCustomerInactivityStatus(
                      c.last_visit_at,
                      c.created_at,
                      now
                    );

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCustomerId(c.id)}
                        className={`w-full flex items-center justify-between p-2.5 text-left transition-colors ${
                          isSelected ? "bg-[#FFF0F1]" : "hover:bg-[#FFF9F5]"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            className={`h-7 w-7 rounded-full ${cInactivity.bgColor} ${cInactivity.borderColor} flex items-center justify-center shrink-0`}
                          >
                            <User
                              size={13}
                              className={cInactivity.iconColor}
                              strokeWidth={2}
                            />
                          </div>
                          <div className="min-w-0 break-words">
                            <p className="text-xs font-bold text-[#1F1F1F]">
                              {cName}
                            </p>
                            <p className="text-[10px] text-[#737373]">
                              {c.phone} {cCode ? `· ${cCode}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[#1F1F1F]">
                            {c.current_stamps} / {rewardTarget} sellos
                          </span>
                          {isSelected && (
                            <Check size={14} className="text-[#FF1F2D]" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector de Acción (2 Clics) */}
              {selectedModalCustomer && (
                <div>
                  <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">
                    2. Elegir acción
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Opción A: Sumar Sello */}
                    <button
                      type="button"
                      onClick={() => setModalAction("STAMP")}
                      className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all ${
                        modalAction === "STAMP"
                          ? "border-[#FF1F2D] bg-[#FFF0F1] shadow-xs"
                          : "border-[#D5CFC4] bg-white hover:bg-[#FFF9F5]"
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-[#FFD9DC] text-[#FF1F2D] mb-2">
                        <Stamp size={16} />
                      </div>
                      <span className="text-xs font-bold text-[#1F1F1F]">
                        Sumar sello (+1)
                      </span>
                      <span className="text-[10px] text-[#737373] mt-0.5">
                        {selectedModalCustomer.current_stamps} →{" "}
                        {selectedModalCustomer.current_stamps + 1} sellos
                      </span>
                    </button>

                    {/* Opción B: Registrar Canje */}
                    <button
                      type="button"
                      onClick={() => setModalAction("REDEEM")}
                      className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all ${
                        modalAction === "REDEEM"
                          ? "border-[#FF1F2D] bg-[#FFF0F1] shadow-xs"
                          : "border-[#D5CFC4] bg-white hover:bg-[#FFF9F5]"
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white border border-[#FFD9DC] text-[#FF1F2D] mb-2">
                        <Gift size={16} />
                      </div>
                      <span className="text-xs font-bold text-[#1F1F1F]">
                        Canjear premio
                      </span>
                      <span className="text-[10px] text-[#737373] mt-0.5">
                        {selectedModalCustomer.current_stamps >= rewardTarget
                          ? "¡Listo para canjear!"
                          : `Faltan ${
                              rewardTarget - selectedModalCustomer.current_stamps
                            } sellos`}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-6 pt-4 border-t border-[#D5CFC4] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-[#D5CFC4] bg-white px-4 py-2 text-xs font-semibold text-[#737373] hover:bg-[#FFF9F5] hover:text-[#1F1F1F]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedModalCustomer || modalSubmitting}
                onClick={handleConfirmModalMovement}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FF1F2D] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#E01522] disabled:opacity-50 transition-colors"
              >
                {modalSubmitting ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  <span>Confirmar movimiento</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
