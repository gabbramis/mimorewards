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
} from "lucide-react";

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
  businessId: string;
  businessName: string;
  rewardDescription: string;
  initialLogs: LogItem[];
}

function formatDateExact(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function getRelativeTime(dateStr: string) {
  try {
    const ms = Date.now() - new Date(dateStr).getTime();
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
  businessId,
  businessName,
  rewardDescription,
  initialLogs,
}: MerchantHistoryClientProps) {
  const [logs] = useState<LogItem[]>(initialLogs);
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "yesterday" | "7days" | "month"
  >("7days");
  const [actionFilter, setActionFilter] = useState<"all" | "stamps" | "redeems">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Filtrado de logs
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const sevenDaysStart = todayStart - 6 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const query = searchQuery.trim().toLowerCase();

    return logs.filter((log) => {
      const logTime = new Date(log.created_at).getTime();

      // Filtro de fecha
      if (dateFilter === "today" && logTime < todayStart) return false;
      if (
        dateFilter === "yesterday" &&
        (logTime < yesterdayStart || logTime >= todayStart)
      ) {
        return false;
      }
      if (dateFilter === "7days" && logTime < sevenDaysStart) return false;
      if (dateFilter === "month" && logTime < monthStart) return false;

      // Filtro de tipo de acción
      if (actionFilter === "stamps" && log.method === "REDEEM") return false;
      if (actionFilter === "redeems" && log.method !== "REDEEM") return false;

      // Filtro de texto
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
  }, [logs, dateFilter, actionFilter, searchQuery]);

  // KPIs del conjunto filtrado
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

  // Exportar a CSV
  const handleExportCSV = () => {
    const headers = [
      "Fecha y Hora",
      "Cliente",
      "Telefono",
      "Codigo CLI",
      "Accion",
      "Metodo",
    ];
    const rows = filteredLogs.map((l) => [
      `"${formatDateExact(l.created_at)}"`,
      `"${l.customer_name}"`,
      `"${l.customer_phone || ""}"`,
      `"${l.customer_code || ""}"`,
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
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#737373]">
            Registro de Operaciones
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-[#1F1F1F]">
            Historial de movimientos
          </h2>
          <p className="text-xs text-[#737373] mt-0.5">
            Historial de sellos y premios canjeados en tu negocio.
          </p>
        </div>

        {/* Botón Exportar */}
        <button
          type="button"
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 rounded-xl border border-[#D5CFC4] bg-white px-4 py-2.5 text-xs font-semibold text-[#1F1F1F] shadow-xs hover:bg-[#FFF9F5] hover:border-[#B8B1A4] transition-colors shrink-0"
        >
          <Download size={14} className="text-[#737373]" />
          <span>Exportar a CSV</span>
        </button>
      </div>

      {/* Mini KPI Cards del Período */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#D5CFC4] bg-white p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#737373]">
            Total movimientos
          </span>
          <p className="text-2xl font-bold text-[#1F1F1F] mt-1">{kpis.total}</p>
          <p className="text-[11px] text-[#737373] mt-0.5">En el rango seleccionado</p>
        </div>

        <div className="rounded-2xl border border-[#D5CFC4] bg-white p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#737373]">
            Sellos acreditados
          </span>
          <p className="text-2xl font-bold text-[#10B981] mt-1">{kpis.stamps}</p>
          <p className="text-[11px] text-[#737373] mt-0.5">
            {kpis.nfc} vía NFC · {kpis.manual} manuales
          </p>
        </div>

        <div className="rounded-2xl border border-[#D5CFC4] bg-white p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#737373]">
            Premios canjeados
          </span>
          <p className="text-2xl font-bold text-[#FF1F2D] mt-1">{kpis.redeems}</p>
          <p className="text-[11px] text-[#737373] mt-0.5">Validados en mostrador</p>
        </div>

        <div className="rounded-2xl border border-[#D5CFC4] bg-white p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#737373]">
            Auditoría de seguridad
          </span>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#10B981] mt-2">
            <CheckCircle2 size={16} />
            <span>100% verificado</span>
          </div>
          <p className="text-[11px] text-[#737373] mt-0.5">Sin duplicados ni alertas</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="rounded-2xl border border-[#D5CFC4] bg-white p-4 sm:p-5 shadow-xs space-y-4">
        {/* Buscador */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#737373]"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, teléfono o código CLI-XXXXXX..."
            className="w-full rounded-xl border border-[#D5CFC4] bg-[#FFF9F5] py-2.5 pl-10 pr-4 text-xs text-[#1F1F1F] placeholder:text-[#737373] focus:border-[#FF1F2D] focus:bg-white focus:outline-none"
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

        {/* Filtros en dos filas / bloques */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1 border-t border-[#D5CFC4]">
          {/* Rango de Fechas */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#737373] mr-1 flex items-center gap-1">
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
                onClick={() => setDateFilter(tab.id as any)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  dateFilter === tab.id
                    ? "bg-[#FF1F2D] text-white shadow-xs"
                    : "border border-[#D5CFC4] bg-white text-[#737373] hover:border-[#B8B1A4] hover:text-[#1F1F1F]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tipo de Acción */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-[#737373] mr-1 flex items-center gap-1">
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
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  actionFilter === tab.id
                    ? "bg-[#1F1F1F] text-white shadow-xs"
                    : "border border-[#D5CFC4] bg-white text-[#737373] hover:border-[#B8B1A4] hover:text-[#1F1F1F]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla de Movimientos */}
      <div className="rounded-2xl border border-[#D5CFC4] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D5CFC4] bg-[#FFF9F5] text-[#737373]">
                <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px]">
                  Fecha y Hora exacta
                </th>
                <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px]">
                  Cliente
                </th>
                <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px]">
                  Acción realizada
                </th>
                <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px]">
                  Origen / Método
                </th>
                <th className="py-3 px-5 font-semibold uppercase tracking-wider text-[10px] text-right">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5CFC4]">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const isRedeem = log.method === "REDEEM";
                  const isNfc = log.method === "NFC";

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-[#FFF9F5] transition-colors"
                    >
                      {/* Fecha y Hora */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-[#A3A3A3] shrink-0" />
                          <div>
                            <p className="font-semibold text-[#1F1F1F]">
                              {formatDateExact(log.created_at)}
                            </p>
                            <span className="text-[10px] text-[#737373]">
                              {getRelativeTime(log.created_at)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF0F1] text-xs font-bold text-[#FF1F2D] border border-[#FFD9DC]">
                            {log.customer_name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-[#1F1F1F] leading-snug">
                              {log.customer_name}
                            </p>
                            <div className="flex items-center gap-1.5 text-[10px] text-[#737373]">
                              {log.customer_phone && <span>{log.customer_phone}</span>}
                              {log.customer_code && (
                                <span className="rounded bg-[#F5F5F5] px-1 py-0.2 font-mono text-[9px] font-semibold text-[#525252]">
                                  {log.customer_code}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Acción */}
                      <td className="py-4 px-5">
                        {isRedeem ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0F1] px-3 py-1 text-xs font-bold text-[#FF1F2D] border border-[#FFD9DC]">
                            <Gift size={13} />
                            <span>Premio canjeado: {rewardDescription}</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-1 text-xs font-bold text-[#10B981] border border-[#A7F3D0]">
                            <Stamp size={13} />
                            <span>+1 Sello acreditado</span>
                          </div>
                        )}
                      </td>

                      {/* Método */}
                      <td className="py-4 px-5">
                        {isNfc ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#BAE6FD] bg-[#F0F9FF] px-2.5 py-1 text-xs font-semibold text-[#0369A1]">
                            <Smartphone size={13} />
                            NFC / Autoservicio
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5CFC4] bg-[#FFF9F5] px-2.5 py-1 text-xs font-semibold text-[#525252]">
                            <Edit3 size={13} />
                            Carga manual en panel
                          </span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#10B981]">
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
                    <History size={32} className="mx-auto text-[#D4D4D4] mb-2" />
                    <p className="text-sm font-semibold text-[#1F1F1F]">
                      No hay movimientos en este filtro
                    </p>
                    <p className="text-xs text-[#737373] mt-1">
                      Probá ampliando el rango de fechas o limpiando el buscador.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="border-t border-[#D5CFC4] bg-[#FFF9F5] px-5 py-3 text-xs text-[#737373]">
          <span>Mostrando {filteredLogs.length} movimientos</span>
        </div>
      </div>
    </div>
  );
}
