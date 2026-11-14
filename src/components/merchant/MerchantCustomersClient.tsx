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
import GoogleWalletButton from "@/components/shared/GoogleWalletButton";
import {
  formatClientNumericId,
  getStampGridLayout,
  MIN_CLIENT_NUMERIC_ID,
  normalizeRewardTarget,
} from "@/lib/wallet-config";

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
      borderColor: "border border-red-500/40",
      bgColor: "bg-red-500/10",
      iconColor: "text-red-400",
      badgeClass: "bg-red-500/10 text-red-400 border border-red-500/20",
      badgeText: "Inactivo (+25 d)",
      dotColor: "bg-red-400",
    };
  }

  const lastMs = new Date(visitDate).getTime();
  const diffDays = Math.max(0, Math.floor((nowMs - lastMs) / (1000 * 60 * 60 * 24)));

  if (diffDays <= 7) {
    return {
      status: "active",
      days: diffDays,
      label: "Nuevos / Activos",
      borderColor: "border border-emerald-500/40",
      bgColor: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      badgeText: diffDays === 0 ? "Hoy (Activo)" : `Hace ${diffDays}d (Activo)`,
      dotColor: "bg-emerald-400",
    };
  } else if (diffDays <= 24) {
    return {
      status: "risk",
      days: diffDays,
      label: "Riesgo",
      borderColor: "border border-zinc-700",
      bgColor: "bg-zinc-950",
      iconColor: "text-zinc-400",
      badgeClass: "bg-zinc-950 text-zinc-400 border border-zinc-800",
      badgeText: `Hace ${diffDays}d (Riesgo)`,
      dotColor: "bg-zinc-400",
    };
  } else {
    return {
      status: "inactive",
      days: diffDays,
      label: "Inactivos",
      borderColor: "border border-red-500/40",
      bgColor: "bg-red-500/10",
      iconColor: "text-red-400",
      badgeClass: "bg-red-500/10 text-red-400 border border-red-500/20",
      badgeText: `Hace ${diffDays}d (Inactivo)`,
      dotColor: "bg-red-400",
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
  return formatClientNumericId(code, "");
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
  const [googleWalletLoading, setGoogleWalletLoading] = useState(false);

  const profileCustomer = useMemo(
    () => customers.find((c) => c.id === profileCustomerId) || null,
    [customers, profileCustomerId]
  );

  const validRewardTarget = useMemo(
    () => normalizeRewardTarget(rewardTarget, 8),
    [rewardTarget]
  );
  const stampGridLayout = useMemo(
    () => getStampGridLayout(validRewardTarget),
    [validRewardTarget]
  );

  const handleOpenGoogleWallet = async (customer: CustomerItem) => {
    if (googleWalletLoading) return;
    setGoogleWalletLoading(true);
    try {
      const numericId = formatClientNumericId(
        customer.unique_code,
        String(MIN_CLIENT_NUMERIC_ID)
      );
      const fullName =
        `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
        "Cliente Mimo";

      const res = await fetch("/api/wallet/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          accountId: numericId,
          uniqueCode: numericId,
          customerName: fullName,
          firstName: customer.first_name || "",
          lastName: customer.last_name || "",
          currentStamps: customer.current_stamps || 0,
          targetStamps: validRewardTarget,
          businessId,
          rewardDescription,
        }),
      });

      const payload = await res.json();
      const targetUrl = payload.url || payload.saveUrl;
      if (!res.ok || !targetUrl) {
        throw new Error(
          payload.error || "No se pudo generar el enlace de Google Wallet."
        );
      }

      window.open(targetUrl, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      showToast(
        err?.message || "Error al generar enlace de Google Wallet.",
        "error"
      );
    } finally {
      setGoogleWalletLoading(false);
    }
  };

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
        const res = await fetch(
          `/api/merchant/customers/${encodeURIComponent(customerId)}/history?businessId=${encodeURIComponent(businessId)}`,
          { cache: "no-store" }
        );

        if (res.ok) {
          const payload = await res.json();
          setHistoryLogs(Array.isArray(payload.logs) ? payload.logs : []);
          return;
        }

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

  useEffect(() => {
    if (!profileCustomerId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileCustomerId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [profileCustomerId]);

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

      if (res.status === 504 || res.status === 500 || res.status >= 500) {
        alert("El servidor está despertando, intenta de nuevo");
        showToast("El servidor está despertando, intenta de nuevo.", "error");
        return;
      }

      const data = await res.json().catch(() => ({}));
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

      if (data.prizeTriggered) {
        showToast(
          `🎉 ¡${clientName} completó la tarjeta (${data.newTotal}/${rewardTarget}) y desbloqueó su premio!`,
          "success"
        );
      } else {
        showToast(
          `¡Sello acreditado a ${clientName}! Total: ${data.newTotal}/${rewardTarget}`,
          "success"
        );
      }
    } catch (err: any) {
      console.error("Error al sumar sello manualmente:", err);
      if (err instanceof TypeError) {
        alert("El servidor está despertando, intenta de nuevo");
      }
      showToast(err.message || "Error al sumar sello.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

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
          className={`fixed bottom-6 left-4 right-4 sm:left-auto sm:max-w-sm sm:right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 border text-sm font-semibold transition-all bg-zinc-900 text-white ${
            toast.type === "success"
              ? "border-emerald-500/40"
              : "border-red-500/40"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-red-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            CRM & Operación de Mostrador
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-white mt-0.5">
            Clientes
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
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
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black hover:bg-gray-200 transition-colors shrink-0 cursor-pointer"
        >
          <Plus size={16} />
          <span>Registrar movimiento manual</span>
        </button>
      </div>

      {/* Banner de Upgrade para Plan Gratis */}
      {isFree && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-zinc-300 border border-zinc-800">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950 border border-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                  <Lock size={10} />
                  PLAN INICIAL
                </span>
                <p className="text-xs sm:text-sm font-semibold text-white">
                  Actualizá a Pro para ver el estado y métricas de retención de tus clientes
                </p>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Desbloqueá el historial detallado por cliente, el semáforo inteligente de inactividad y frecuencia de visitas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUpgradeModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black hover:bg-gray-200 transition-all shrink-0 cursor-pointer"
          >
            <Zap size={14} />
            <span>Mejorar a Pro</span>
          </button>
        </div>
      )}

      {/* Card de Búsqueda y Filtros Rápidos */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5 space-y-4">
        {/* Buscador en tiempo real */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, teléfono o ID de cliente (ej. 4812)..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-zinc-500 focus:border-white focus:ring-1 focus:ring-white focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
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
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              activeFilter === "all"
                ? "bg-white text-black font-semibold"
                : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
            }`}
          >
            Todos ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("ready")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              activeFilter === "ready"
                ? "bg-white text-black font-semibold"
                : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
            }`}
          >
            <Gift size={12} />
            Listos para canjear ({counts.ready})
          </button>

          {isFree ? (
            <button
              type="button"
              onClick={() => setUpgradeModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium border border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800 transition-all cursor-pointer"
              title="Actualizá a Pro para ver el semáforo de retención"
            >
              <Lock size={12} className="text-zinc-400" />
              <span>Semáforo de retención</span>
              <span className="rounded-full bg-zinc-800 px-1.5 py-0.2 text-[9px] font-semibold uppercase text-white">
                PRO
              </span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveFilter("active")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  activeFilter === "active"
                    ? "bg-white text-black font-semibold"
                    : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Nuevos / Activos ({counts.active})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("risk")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  activeFilter === "risk"
                    ? "bg-white text-black font-semibold"
                    : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-zinc-400" />
                Riesgo ({counts.risk})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("inactive")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  activeFilter === "inactive"
                    ? "bg-white text-black font-semibold"
                    : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Inactivos ({counts.inactive})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabla de Clientes */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[680px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400">
                <th className="py-3.5 px-5 font-medium uppercase tracking-wider text-[10px] whitespace-nowrap">
                  Cliente
                </th>
                <th className="py-3.5 px-5 font-medium uppercase tracking-wider text-[10px] whitespace-nowrap">
                  Progreso actual
                </th>
                {!isFree && (
                  <th className="py-3.5 px-5 font-medium uppercase tracking-wider text-[10px] whitespace-nowrap">
                    Visitas totales
                  </th>
                )}
                {!isFree && (
                  <th className="py-3.5 px-5 font-medium uppercase tracking-wider text-[10px] whitespace-nowrap">
                    Última visita
                  </th>
                )}
                <th className="py-3.5 px-5 font-medium uppercase tracking-wider text-[10px] text-right whitespace-nowrap">
                  Acciones rápidas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
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
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Cliente */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {isFree ? (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400">
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
                              className="font-semibold text-white leading-snug text-left cursor-pointer hover:underline hover:text-primary transition-colors"
                            >
                              {clientName}
                            </button>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                              {customer.phone && <span>{customer.phone}</span>}
                              {numericCode && (
                                <span className="rounded bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 font-mono text-[9px] font-medium text-zinc-300">
                                  {numericCode}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Progreso (Sellos actuales) */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="w-36 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-semibold">
                            <span className="text-white">
                              {stamps} / {rewardTarget} sellos
                            </span>
                            {isReady && (
                              <span className="text-[10px] text-emerald-400 font-semibold">
                                ¡Listo!
                              </span>
                            )}
                          </div>
                          <div className="h-2 w-full rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                            <div
                              style={{ width: `${percent}%` }}
                              className={`h-full rounded-full transition-all duration-300 ${
                                isReady ? "bg-emerald-400" : "bg-white"
                              }`}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Visitas totales */}
                      {!isFree && (
                        <td className="py-4 px-5 font-semibold text-white whitespace-nowrap">
                          <span>{customer.total_visits || 1} visitas</span>
                        </td>
                      )}

                      {/* Última visita */}
                      {!isFree && (
                        <td className="py-4 px-5 text-zinc-400 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1.5 text-xs font-medium text-white">
                              <Clock size={13} className="text-zinc-500" />
                              {formatDate(customer.last_visit_at)}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium w-fit ${inactivity.badgeClass}`}
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
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleAddStamp(customer.id, clientName)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white disabled:opacity-50 transition-all cursor-pointer"
                          >
                            <Stamp size={13} className="text-zinc-400" />
                            <span>+1 Sello</span>
                          </button>

                          <button
                            type="button"
                            disabled={!isReady || isLoading}
                            onClick={() => handleRedeem(customer.id, clientName)}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                              isReady
                                ? "bg-white text-black hover:bg-gray-200 cursor-pointer"
                                : "bg-zinc-950 text-zinc-600 cursor-not-allowed border border-zinc-800"
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
                    <Users size={32} className="mx-auto text-zinc-500 mb-2" />
                    <p className="text-sm font-semibold text-white">
                      No se encontraron clientes
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
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
          <div className="border-t border-zinc-800 bg-zinc-950 px-5 py-3 text-xs text-zinc-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-zinc-300 font-medium">
              <Lock size={13} className="text-zinc-400 shrink-0" />
              <span>
                Actualizá a Pro para ver el estado y métricas de retención de tus clientes.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setUpgradeModalOpen(true)}
              className="text-xs font-semibold text-white hover:underline shrink-0 cursor-pointer"
            >
              Mejorar a Pro →
            </button>
          </div>
        )}

        {/* Footer de resumen */}
        <div className="border-t border-zinc-800 bg-zinc-950 px-5 py-3 text-xs text-zinc-400 flex flex-wrap gap-2 items-center justify-between">
          <span>
            Mostrando {filteredCustomers.length} de {customers.length} clientes
          </span>
          <span className="font-medium text-zinc-300">
            Meta activa: {rewardTarget} sellos = {rewardDescription}
          </span>
        </div>
      </div>

      {/* SLIDE-OVER / SHEET: Perfil del Cliente e Historial Detallado */}
      {profileCustomer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setProfileCustomerId(null)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-profile-title"
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-full w-full sm:max-w-md flex-col bg-zinc-900 border-l border-zinc-800 overflow-hidden animate-in slide-in-from-right duration-200"
          >
            {/* Cabecera del Slide-over */}
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-6 py-5">
              <div className="min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                  Perfil del Cliente
                </span>
                <h3
                  id="customer-profile-title"
                  className="text-lg font-semibold text-white truncate mt-0.5"
                >
                  {`${profileCustomer.first_name || ""} ${profileCustomer.last_name || ""}`.trim() ||
                    profileCustomer.phone ||
                    "Cliente"}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  {formatNumericCode(profileCustomer.unique_code) && (
                    <span className="inline-flex items-center rounded-md bg-zinc-900 border border-zinc-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">
                      {formatNumericCode(profileCustomer.unique_code)}
                    </span>
                  )}
                  {profileCustomer.phone && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                      <Phone size={12} className="text-zinc-500" />
                      {profileCustomer.phone}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileCustomerId(null)}
                aria-label="Cerrar perfil del cliente"
                className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumen de Progreso, Sellos y Google Wallet del Cliente */}
            <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                    Sellos actuales
                  </span>
                  <p className="mt-1 text-base font-semibold text-white">
                    {profileCustomer.current_stamps} / {validRewardTarget}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                    Visitas registradas
                  </span>
                  <p className="mt-1 text-base font-semibold text-white">
                    {isFree ? "—" : `${profileCustomer.total_visits || 1} visitas`}
                  </p>
                </div>
              </div>

              {/* Disposición visual de sellos (4: 2x2, 5: 5 en línea, 6: 3x2, 8: 4x2, 10: 5x2) */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5">
                <div className="mb-2.5 flex items-center justify-between text-[11px]">
                  <span className="font-medium text-zinc-400">
                    Tarjeta de sellos ({validRewardTarget} sellos)
                  </span>
                  <span className="font-mono text-zinc-300 font-semibold">
                    {formatNumericCode(profileCustomer.unique_code) || String(MIN_CLIENT_NUMERIC_ID)}
                  </span>
                </div>
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${stampGridLayout.columns}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${stampGridLayout.rows}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: validRewardTarget }, (_, idx) => {
                    const filled = idx < (profileCustomer.current_stamps || 0);
                    return (
                      <div
                        key={idx}
                        className={`flex aspect-square max-w-[44px] w-full mx-auto items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
                          filled
                            ? "border-white bg-white text-black"
                            : "border-zinc-800 bg-zinc-900 text-zinc-500"
                        }`}
                      >
                        <Stamp size={14} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botón Oficial de Google Wallet */}
              <GoogleWalletButton
                onClick={() => handleOpenGoogleWallet(profileCustomer)}
                loading={googleWalletLoading}
                loadingText="Generando enlace de Google Wallet…"
                disabled={googleWalletLoading}
                className="w-full"
              />
            </div>

            {/* Cuerpo del Slide-over: Paywall vs Timeline de Movimientos */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <History size={14} className="text-zinc-400" />
                  <span>Historial de movimientos</span>
                </h4>
                {!isFree && !historyLoading && (
                  <span className="text-[11px] font-medium text-zinc-500">
                    {historyLogs.length}{" "}
                    {historyLogs.length === 1 ? "registro" : "registros"}
                  </span>
                )}
              </div>

              {isFree ? (
                <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-zinc-300 border border-zinc-800">
                    <Lock size={20} />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-300 mb-2">
                    <Sparkles size={11} />
                    Exclusivo Pro / Premium
                  </span>
                  <p className="text-sm font-semibold text-white leading-snug">
                    El historial detallado de clientes es una función exclusiva de los planes Pro y Premium
                  </p>
                  <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
                    Consultá cada sello acreditado, canjes de premios, fecha, hora exacta y operador que realizó el registro.
                  </p>
                  <button
                    type="button"
                    onClick={() => setUpgradeModalOpen(true)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    <Zap size={14} />
                    <span>Mejorar plan</span>
                  </button>
                </div>
              ) : historyLoading ? (
                <div className="py-12 text-center">
                  <RefreshCw
                    size={24}
                    className="mx-auto animate-spin text-white mb-2"
                  />
                  <p className="text-xs font-medium text-zinc-400">
                    Cargando historial del cliente...
                  </p>
                </div>
              ) : historyError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center">
                  <p className="text-xs font-semibold text-red-400">
                    {historyError}
                  </p>
                  <button
                    type="button"
                    onClick={() => fetchCustomerHistory(profileCustomer.id)}
                    className="mt-2 text-xs font-semibold text-white hover:underline"
                  >
                    Reintentar
                  </button>
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center">
                  <History size={28} className="mx-auto text-zinc-500 mb-2" />
                  <p className="text-sm font-semibold text-white">
                    Sin movimientos registrados
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Los sellos y canjes de este cliente aparecerán en esta línea de tiempo.
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-zinc-800 space-y-4">
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
                        <span
                          className={`absolute -left-6 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 ${
                            isRedeem ? "text-amber-400" : "text-emerald-400"
                          }`}
                        >
                          {isRedeem ? <Gift size={12} /> : <Stamp size={12} />}
                        </span>

                        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                                isRedeem
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              }`}
                            >
                              {isRedeem
                                ? "Canje de premio"
                                : `+${stampsCount} ${
                                    stampsCount === 1 ? "Sello" : "Sellos"
                                  }`}
                            </span>

                            <div className="text-right text-[11px] text-zinc-400 shrink-0">
                              <span className="font-semibold text-white">
                                {datePart}
                              </span>
                              {timePart && (
                                <span className="ml-1 text-zinc-400">
                                  · {timePart}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                            <span className="inline-flex items-center gap-1 font-medium">
                              {isNfc ? (
                                <>
                                  <Smartphone size={12} className="text-zinc-300" />
                                  <span>NFC / Autoservicio</span>
                                </>
                              ) : isQr ? (
                                <>
                                  <QrCode size={12} className="text-zinc-300" />
                                  <span>Escaneo QR en caja</span>
                                </>
                              ) : (
                                <>
                                  <Edit3 size={12} className="text-zinc-400" />
                                  <span>Registro manual en panel</span>
                                </>
                              )}
                            </span>

                            {registeredBy && (
                              <span
                                className="inline-flex items-center gap-1 rounded-md bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400 truncate max-w-full"
                                title={`Registrado por ${registeredBy}`}
                              >
                                <User size={10} className="text-zinc-500 shrink-0" />
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
            <div className="border-t border-zinc-800 bg-zinc-950 px-6 py-3.5 flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Calendar size={13} />
                Alta: {formatDate(profileCustomer.created_at)}
              </span>
              <button
                type="button"
                onClick={() => setProfileCustomerId(null)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MODAL: Registrar Movimiento Manual */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl border border-zinc-800 bg-zinc-900 p-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                  Operación Manual
                </span>
                <h3 className="text-lg font-semibold text-white">
                  Registrar movimiento manual
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Sumá sellos o canjeá premios sin necesidad de escáner.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Cerrar registro de movimiento"
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  1. Seleccionar cliente
                </label>
                <div className="relative">
                  <Search
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="Escribí nombre, teléfono o ID (ej. 4812)..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-zinc-500 focus:border-white focus:ring-1 focus:ring-white focus:outline-none"
                  />
                </div>

                {/* Lista desplegable de clientes coincidentes */}
                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800/50">
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
                        className={`w-full flex items-center justify-between p-2.5 text-left transition-colors cursor-pointer ${
                          isSelected ? "bg-zinc-800" : "hover:bg-zinc-900"
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
                            <p className="text-xs font-semibold text-white">
                              {cName}
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              {c.phone} {cCode ? `· ${cCode}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-white">
                            {c.current_stamps} / {rewardTarget} sellos
                          </span>
                          {isSelected && (
                            <Check size={14} className="text-white" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selector de Acción */}
              {selectedModalCustomer && (
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">
                    2. Elegir acción
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setModalAction("STAMP")}
                      className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        modalAction === "STAMP"
                          ? "border-white bg-zinc-800"
                          : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900"
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-white mb-2">
                        <Stamp size={16} />
                      </div>
                      <span className="text-xs font-semibold text-white">
                        Sumar sello (+1)
                      </span>
                      <span className="text-[10px] text-zinc-400 mt-0.5">
                        {selectedModalCustomer.current_stamps} →{" "}
                        {selectedModalCustomer.current_stamps + 1} sellos
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalAction("REDEEM")}
                      className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        modalAction === "REDEEM"
                          ? "border-white bg-zinc-800"
                          : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900"
                      }`}
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-white mb-2">
                        <Gift size={16} />
                      </div>
                      <span className="text-xs font-semibold text-white">
                        Canjear premio
                      </span>
                      <span className="text-[10px] text-zinc-400 mt-0.5">
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
            <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!selectedModalCustomer || modalSubmitting}
                onClick={handleConfirmModalMovement}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2 text-xs font-semibold text-black hover:bg-gray-200 disabled:opacity-50 transition-colors cursor-pointer"
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
