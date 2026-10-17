"use client";

import React, { useState, useMemo } from "react";
import {
  Users,
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
  ChevronRight,
  RefreshCw,
  Smartphone,
} from "lucide-react";

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

interface MerchantCustomersClientProps {
  businessId: string;
  initialCustomers: CustomerItem[];
  rewardTarget: number;
  rewardDescription: string;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Sin visitas";
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

export default function MerchantCustomersClient({
  businessId,
  initialCustomers,
  rewardTarget,
  rewardDescription,
}: MerchantCustomersClientProps) {
  const [customers, setCustomers] = useState<CustomerItem[]>(initialCustomers);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "ready" | "frequent" | "inactive"
  >("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Modal State
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

  // Filtrado y segmentación rápida
  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    return customers.filter((c) => {
      // Búsqueda de texto
      const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const rawCode = (c.unique_code || "").toLowerCase();
      const cleanCode = rawCode.replace(/^cli-?/i, "");
      const cleanQuery = query.replace(/^cli-?/i, "");

      const matchesCode =
        rawCode.includes(query) ||
        (cleanQuery.length > 0 && cleanCode.includes(cleanQuery));

      const matchesQuery =
        !query ||
        fullName.includes(query) ||
        phone.includes(query) ||
        matchesCode;

      if (!matchesQuery) return false;

      // Filtros rápidos
      if (activeFilter === "ready") {
        return c.current_stamps >= rewardTarget;
      }
      if (activeFilter === "frequent") {
        return (c.total_visits || 0) >= 2;
      }
      if (activeFilter === "inactive") {
        if (!c.last_visit_at) return true;
        const lastVisitMs = new Date(c.last_visit_at).getTime();
        return now - lastVisitMs > thirtyDaysMs;
      }
      return true;
    });
  }, [customers, searchQuery, activeFilter, rewardTarget]);

  // Contadores para chips
  const counts = useMemo(() => {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    let ready = 0;
    let frequent = 0;
    let inactive = 0;

    customers.forEach((c) => {
      if (c.current_stamps >= rewardTarget) ready++;
      if ((c.total_visits || 0) >= 2) frequent++;
      if (!c.last_visit_at || now - new Date(c.last_visit_at).getTime() > thirtyDaysMs) {
        inactive++;
      }
    });

    return {
      all: customers.length,
      ready,
      frequent,
      inactive,
    };
  }, [customers, rewardTarget]);

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
    const cleanQ = q.replace(/^cli-?/i, "");

    return customers
      .filter((c) => {
        const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        const rawCode = (c.unique_code || "").toLowerCase();
        const cleanCode = rawCode.replace(/^cli-?/i, "");

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
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl border text-sm font-semibold transition-all ${
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

      {/* Card de Búsqueda y Filtros Rápidos */}
      <div className="rounded-2xl border border-[#F0E6DE] bg-white p-4 sm:p-5 shadow-xs space-y-4">
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
            placeholder="Buscar por nombre, teléfono o código (ej. 493146)..."
            className="w-full rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] py-2.5 pl-10 pr-4 text-xs text-[#1F1F1F] placeholder:text-[#737373] focus:border-[#FF1F2D] focus:bg-white focus:outline-none transition-colors"
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
                ? "bg-[#FF1F2D] text-white shadow-xs"
                : "border border-[#F0E6DE] bg-white text-[#737373] hover:border-[#E2D5CB] hover:text-[#1F1F1F]"
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
          <button
            type="button"
            onClick={() => setActiveFilter("frequent")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === "frequent"
                ? "bg-[#FF1F2D] text-white shadow-xs"
                : "border border-[#F0E6DE] bg-white text-[#737373] hover:border-[#E2D5CB] hover:text-[#1F1F1F]"
            }`}
          >
            Frecuentes ({counts.frequent})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("inactive")}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeFilter === "inactive"
                ? "bg-[#FF1F2D] text-white shadow-xs"
                : "border border-[#F0E6DE] bg-white text-[#737373] hover:border-[#E2D5CB] hover:text-[#1F1F1F]"
            }`}
          >
            Inactivos (+30 días) ({counts.inactive})
          </button>
        </div>
      </div>

      {/* Tabla de Clientes */}
      <div className="rounded-2xl border border-[#F0E6DE] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#F0E6DE] bg-[#FFF9F5] text-[#737373]">
                <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px]">
                  Cliente
                </th>
                <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px]">
                  Progreso actual
                </th>
                <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px]">
                  Visitas totales
                </th>
                <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px]">
                  Última visita
                </th>
                <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px] text-right">
                  Acciones rápidas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0E6DE]">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => {
                  const clientName =
                    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
                    customer.phone ||
                    "Cliente";
                  const stamps = customer.current_stamps || 0;
                  const isReady = stamps >= rewardTarget;
                  const percent = Math.min(
                    Math.round((stamps / rewardTarget) * 100),
                    100
                  );
                  const isLoading = actionLoadingId === customer.id;

                  return (
                    <tr
                      key={customer.id}
                      className="hover:bg-[#FFF9F5] transition-colors"
                    >
                      {/* Cliente */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF0F1] text-xs font-bold text-[#FF1F2D] border border-[#FFD9DC]">
                            {clientName.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#1F1F1F] leading-snug">
                              {clientName}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-[#737373] mt-0.5">
                              {customer.phone && <span>{customer.phone}</span>}
                              {customer.unique_code && (
                                <span className="rounded bg-[#F5F5F5] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#525252]">
                                  {customer.unique_code}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Progreso */}
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

                      {/* Visitas */}
                      <td className="py-4 px-5 font-semibold text-[#1F1F1F]">
                        <span>{customer.total_visits || 1} visitas</span>
                      </td>

                      {/* Última visita */}
                      <td className="py-4 px-5 text-[#737373] whitespace-nowrap">
                        <span className="flex items-center gap-1.5 text-xs">
                          <Clock size={13} className="text-[#A3A3A3]" />
                          {formatDate(customer.last_visit_at)}
                        </span>
                      </td>

                      {/* Acciones Rápidas */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {/* Botón directo +1 Sello */}
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleAddStamp(customer.id, clientName)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#F0E6DE] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F1F1F] hover:bg-[#FFF9F5] hover:border-[#E2D5CB] disabled:opacity-50 transition-all shadow-2xs"
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
                  <td colSpan={5} className="py-12 text-center">
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

        {/* Footer de resumen */}
        <div className="border-t border-[#F0E6DE] bg-[#FFF9F5] px-5 py-3 text-xs text-[#737373] flex items-center justify-between">
          <span>
            Mostrando {filteredCustomers.length} de {customers.length} clientes
          </span>
          <span className="font-medium text-[#1F1F1F]">
            Meta activa: {rewardTarget} sellos = {rewardDescription}
          </span>
        </div>
      </div>

      {/* MODAL: + Registrar Movimiento Manual */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div
            className="w-full max-w-lg rounded-3xl border border-[#F0E6DE] bg-white p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#F0E6DE] pb-4">
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
                    placeholder="Escribí nombre, teléfono o código (ej. 493146)..."
                    className="w-full rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] py-2.5 pl-9 pr-3 text-xs text-[#1F1F1F] placeholder:text-[#737373] focus:border-[#FF1F2D] focus:bg-white focus:outline-none"
                  />
                </div>

                {/* Lista desplegable de clientes coincidentes */}
                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-[#F0E6DE] bg-white divide-y divide-[#F0E6DE]">
                  {modalSearchResults.map((c) => {
                    const isSelected = selectedCustomerId === c.id;
                    const cName =
                      `${c.first_name || ""} ${c.last_name || ""}`.trim() ||
                      c.phone ||
                      "Cliente";

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCustomerId(c.id)}
                        className={`w-full flex items-center justify-between p-2.5 text-left transition-colors ${
                          isSelected ? "bg-[#FFF0F1]" : "hover:bg-[#FFF9F5]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-[#FFF9F5] border border-[#F0E6DE] flex items-center justify-center font-bold text-[11px] text-[#FF1F2D]">
                            {cName.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#1F1F1F]">
                              {cName}
                            </p>
                            <p className="text-[10px] text-[#737373]">
                              {c.phone} · {c.unique_code}
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
                          : "border-[#F0E6DE] bg-white hover:bg-[#FFF9F5]"
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
                          : "border-[#F0E6DE] bg-white hover:bg-[#FFF9F5]"
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
            <div className="mt-6 pt-4 border-t border-[#F0E6DE] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-[#F0E6DE] bg-white px-4 py-2 text-xs font-semibold text-[#737373] hover:bg-[#FFF9F5] hover:text-[#1F1F1F]"
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
