"use client";

import React, { useState, useMemo } from "react";
import {
  History,
  Search,
  Calendar,
  Filter,
  Stamp,
  Gift,
  Smartphone,
  Edit3,
  Clock,
  Download,
  X,
  CheckCircle2,
  Lock,
} from "lucide-react";
import DatePickerCalendar from "./DatePickerCalendar";
import { useBusiness, isPlanFree } from "@/contexts/BusinessContext";
import UpgradeModal from "./UpgradeModal";
import { formatMerchantDate, merchantDateKey } from "@/lib/merchant-dates";

export interface LogItem {
  id: string;
  created_at: string;
  method: string;
  customer_id: string;
  metadata?: any;
  customer_name: string;
  customer_phone: string | null;
  customer_code: string | null;
}

interface MerchantHistoryClientProps {
  referenceNow: number;
  businessId: string;
  businessName: string;
  rewardDescription: string;
  initialLogs: LogItem[];
  businessCreatedAt?: string | null;
  allStampDates?: string[];
  planType?: string | null;
}

function formatDateExact(dateStr: string) {
  return formatMerchantDate(dateStr, true);
}

function getRelativeTime(dateStr: string, now: number) {
  try {
    const ms = now - new Date(dateStr).getTime();
    const minutes = Math.floor(ms / (1000 * 60));
    if (minutes < 1) return "Recién";
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} d`;
  } catch {
    return "";
  }
}

export default function MerchantHistoryClient({
  referenceNow,
  businessName,
  rewardDescription,
  initialLogs,
  businessCreatedAt,
  allStampDates,
  planType,
}: MerchantHistoryClientProps) {
  const { isFreePlan: contextIsFree } = useBusiness();
  const isFree = planType !== undefined ? isPlanFree(planType) : contextIsFree;

  const [logs] = useState<LogItem[]>(initialLogs);
  const [now] = useState(referenceNow);
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "yesterday" | "7days" | "month" | "custom"
  >("7days");
  const [selectedCustomDate, setSelectedCustomDate] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<"all" | "stamps" | "redeems">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const stampsCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    if (allStampDates && allStampDates.length > 0) {
      for (const dStr of allStampDates) {
        const d = new Date(dStr);
        if (!isNaN(d.getTime())) {
          const key = merchantDateKey(dStr);
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    } else {
      for (const log of logs) {
        if (log.method !== "REDEEM") {
          const d = new Date(log.created_at);
          if (!isNaN(d.getTime())) {
            const key = merchantDateKey(log.created_at);
            counts[key] = (counts[key] || 0) + 1;
          }
        }
      }
    }
    return counts;
  }, [allStampDates, logs]);

  const filteredLogs = useMemo(() => {
    const todayKey = merchantDateKey(now);
    const dayMs = 24 * 60 * 60 * 1000;
    const yesterdayKey = merchantDateKey(now - dayMs);
    const sevenDaysKey = merchantDateKey(now - 6 * dayMs);
    const monthKey = `${todayKey.slice(0, 7)}-01`;

    const query = searchQuery.trim().toLowerCase();

    return logs.filter((log) => {
      const logKey = merchantDateKey(log.created_at);

      if (dateFilter === "today" && logKey < todayKey) return false;
      if (
        dateFilter === "yesterday" &&
        logKey !== yesterdayKey
      ) {
        return false;
      }
      if (dateFilter === "7days" && logKey < sevenDaysKey) return false;
      if (dateFilter === "month" && logKey < monthKey) return false;
      if (dateFilter === "custom" && selectedCustomDate) {
        if (logKey !== selectedCustomDate) return false;
      }

      if (actionFilter === "stamps" && log.method === "REDEEM") return false;
      if (actionFilter === "redeems" && log.method !== "REDEEM") return false;

      if (query) {
        const name = (log.customer_name || "").toLowerCase();
        const phone = (log.customer_phone || "").toLowerCase();
        const code = (log.customer_code || "").toLowerCase();
        if (
          !name.includes(query) &&
          !phone.includes(query) &&
          !code.includes(query)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [logs, dateFilter, selectedCustomDate, actionFilter, searchQuery, now]);

  const kpis = useMemo(() => {
    let stamps = 0;
    let redeems = 0;
    let nfc = 0;
    let manual = 0;

    filteredLogs.forEach((l) => {
      if (l.method === "REDEEM") {
        redeems++;
      } else {
        stamps++;
        if (l.method === "NFC") nfc++;
        else manual++;
      }
    });

    return { stamps, redeems, nfc, manual, total: filteredLogs.length };
  }, [filteredLogs]);

  const handleExportCSV = () => {
    if (isFree) {
      setUpgradeModalOpen(true);
      return;
    }

    const headers = [
      "Fecha y Hora",
      "Cliente",
      "Telefono",
      "ID Cliente",
      "Accion",
      "Metodo",
    ];
    const rows = filteredLogs.map((l) => [
      `"${formatDateExact(l.created_at)}"`,
      `"${l.customer_name}"`,
      `"${l.customer_phone || ""}"`,
      `"${String(l.customer_code || "").replace(/^CLI\s*-\s*/i, "").trim()}"`,
      `"${l.method === "REDEEM" ? "Premio canjeado" : "+1 Sello acreditado"}"`,
      `"${l.method === "NFC" ? "NFC Autoservicio" : "Carga manual"}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `auditoria_movimientos_${businessName.replace(/\s+/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Modal de Upgrade */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Mejora tu plan para exportar datos"
        description="La descarga de reportes y transacciones a CSV es una funcionalidad exclusiva del Plan Pro para ayudarte a conciliar y auditar tus números."
        feature="export"
      />

      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
            Registro de Operaciones
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-white mt-0.5">
            Historial de movimientos
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Historial de sellos y premios canjeados en tu negocio.
          </p>
        </div>

        {/* Botón Exportar */}
        {isFree ? (
          <button
            type="button"
            onClick={() => setUpgradeModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors shrink-0 group cursor-pointer"
            title="Mejora tu plan para exportar datos"
          >
            <Lock size={13} className="text-zinc-400" />
            <span>Exportar a CSV</span>
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-white tracking-wider">
              PRO
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black hover:bg-gray-200 transition-colors shrink-0 cursor-pointer"
          >
            <Download size={14} />
            <span>Exportar a CSV</span>
          </button>
        )}
      </div>

      {/* Mini KPI Cards del Período */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Total movimientos
          </span>
          <p className="text-2xl font-semibold text-white mt-1">{kpis.total}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">En el rango seleccionado</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Sellos acreditados
          </span>
          <p className="text-2xl font-semibold text-white mt-1">{kpis.stamps}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            {kpis.nfc} vía NFC · {kpis.manual} manuales
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Premios canjeados
          </span>
          <p className="text-2xl font-semibold text-white mt-1">{kpis.redeems}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Validados en mostrador</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Auditoría de seguridad
          </span>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mt-2">
            <CheckCircle2 size={16} />
            <span>100% verificado</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">Sin duplicados ni alertas</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5 space-y-4">
        {/* Buscador */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, teléfono o ID (ej. 15001)..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-zinc-500 focus:border-white focus:ring-1 focus:ring-white focus:outline-none"
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

        {/* Filtros */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-zinc-800">
          {/* Rango de Fechas */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-zinc-400 mr-1 flex items-center gap-1">
              <Calendar size={13} />
              Período:
            </span>
            {[
              { id: "today", label: "Hoy" },
              { id: "yesterday", label: "Ayer" },
              { id: "7days", label: "Últimos 7 días" },
              { id: "month", label: "Este mes" },
              { id: "all", label: "Todo el historial" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setDateFilter(tab.id as any);
                  setSelectedCustomDate(null);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                  dateFilter === tab.id
                    ? "bg-white text-black font-semibold"
                    : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}

            <DatePickerCalendar
              selectedDate={selectedCustomDate}
              onSelectDate={(dateStr) => {
                setSelectedCustomDate(dateStr);
                setDateFilter("custom");
              }}
              onClear={() => {
                setSelectedCustomDate(null);
                setDateFilter("7days");
              }}
              businessCreatedAt={businessCreatedAt}
              stampsCountByDate={stampsCountByDate}
              isActive={dateFilter === "custom"}
            />
          </div>

          {/* Tipo de Acción */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-zinc-400 mr-1 flex items-center gap-1">
              <Filter size={13} />
              Acción:
            </span>
            {[
              { id: "all", label: "Todos" },
              { id: "stamps", label: "Solo sellos" },
              { id: "redeems", label: "Solo canjes" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActionFilter(tab.id as any)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                  actionFilter === tab.id
                    ? "bg-white text-black font-semibold"
                    : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla de Movimientos */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[680px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950 text-zinc-400">
                <th className="py-3.5 px-5 font-medium uppercase tracking-wider text-[10px] whitespace-nowrap">
                  Fecha y Hora exacta
                </th>
                <th className="py-3.5 px-5 font-medium uppercase tracking-wider text-[10px] whitespace-nowrap">
                  Cliente
                </th>
                <th className="py-3.5 px-5 font-medium uppercase tracking-wider text-[10px] whitespace-nowrap">
                  Acción realizada
                </th>
                <th className="py-3.5 px-5 font-medium uppercase tracking-wider text-[10px] whitespace-nowrap">
                  Origen / Método
                </th>
                <th className="py-3.5 px-5 font-medium uppercase tracking-wider text-[10px] text-right whitespace-nowrap">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const isRedeem = log.method === "REDEEM";
                  const isNfc = log.method === "NFC";

                  return (
                    <tr
                      key={log.id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* Fecha y Hora */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-zinc-500 shrink-0" />
                          <div>
                            <p className="font-semibold text-white">
                              {formatDateExact(log.created_at)}
                            </p>
                            <span className="text-[10px] text-zinc-500">
                              {getRelativeTime(log.created_at, now)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white border border-zinc-800">
                            {log.customer_name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-white leading-snug">
                              {log.customer_name}
                            </p>
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                              {log.customer_phone && <span>{log.customer_phone}</span>}
                              {log.customer_code && (
                                <span className="rounded bg-zinc-950 border border-zinc-800 px-1 py-0.2 font-mono text-[9px] font-medium text-zinc-300">
                                  {String(log.customer_code || "").replace(/^CLI\s*-\s*/i, "").trim()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Acción */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        {isRedeem ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 border border-amber-500/20">
                            <Gift size={13} />
                            <span>Premio canjeado: {rewardDescription}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                            <Stamp size={13} />
                            <span>+1 Sello acreditado</span>
                          </div>
                        )}
                      </td>

                      {/* Método */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        {isNfc ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs font-medium text-zinc-300">
                            <Smartphone size={13} className="text-zinc-400" />
                            NFC / Autoservicio
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs font-medium text-zinc-400">
                            <Edit3 size={13} />
                            Carga manual en panel
                          </span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                          <CheckCircle2 size={13} />
                          {isRedeem ? "Canje entregado" : "Acreditado"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <History size={32} className="mx-auto text-zinc-500 mb-2" />
                    <p className="text-sm font-semibold text-white">
                      No hay movimientos en este filtro
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Probá ampliando el rango de fechas o limpiando el buscador.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 bg-zinc-950 px-5 py-3 text-xs text-zinc-400">
          <span>Mostrando {filteredLogs.length} movimientos</span>
        </div>
      </div>
    </div>
  );
}
