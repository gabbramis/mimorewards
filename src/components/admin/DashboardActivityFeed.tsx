"use client";

import { useState } from "react";
import { Clock, Search, Star, Gift } from "lucide-react";

export type ActivityLog = {
  id: string;
  method: string;
  created_at: string;
  business_id: string;
  customers: {
    first_name: string | null;
    last_name: string | null;
    unique_code: string | null;
  } | null;
  businesses: {
    name: string | null;
  } | null;
};

export function DashboardActivityFeed({ logs }: { logs: ActivityLog[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");

  const filteredLogs = logs.filter((log) => {
    const fullName = log.customers
      ? `${log.customers.first_name || ""} ${log.customers.last_name || ""}`.trim().toLowerCase()
      : "";
    const code = log.customers?.unique_code?.toLowerCase() || "";
    const businessName = log.businesses?.name?.toLowerCase() || "";
    const query = searchQuery.toLowerCase().trim();

    const matchesSearch = !query || fullName.includes(query) || code.includes(query) || businessName.includes(query);

    let matchesFilter = true;
    if (activeFilter === "Sellos") matchesFilter = log.method !== "REDEEM";
    if (activeFilter === "Canjes") matchesFilter = log.method === "REDEEM";

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 sm:p-6 border-b border-gray-100 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Clock size={20} className="text-[#FF1F2D]" />
              Flujo de Actividad Reciente
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Últimas transacciones, sellos emitidos y canjes en todos los comercios.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="Buscar por cliente, código o comercio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-xs sm:text-sm rounded-xl pl-9 pr-4 py-2 focus:bg-white focus:ring-2 focus:ring-[#FF1F2D]/20 focus:border-[#FF1F2D] outline-none transition"
            />
          </div>
        </div>

        <div className="flex bg-gray-100/80 rounded-xl p-1 w-full sm:w-auto self-start inline-flex">
          {["Todos", "Sellos", "Canjes"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                activeFilter === f
                  ? "bg-white text-gray-900 shadow-xs border border-gray-200/60"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-left font-medium min-w-[650px]">
          <thead className="bg-gray-50/70 text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 font-bold">
            <tr>
              <th className="px-6 py-3.5">Cliente</th>
              <th className="px-6 py-3.5">Operación</th>
              <th className="px-6 py-3.5">Comercio</th>
              <th className="px-6 py-3.5 text-right">Fecha y Hora</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-xs text-gray-400">
                  No se encontraron actividades con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isRedeem = log.method === "REDEEM";
                const clientName = log.customers
                  ? `${log.customers.first_name || ""} ${log.customers.last_name || ""}`.trim() || "Cliente"
                  : "Cliente";
                const shortCode = log.customers?.unique_code || "N/A";
                const initials = log.customers
                  ? `${log.customers.first_name?.[0] || "?"}${log.customers.last_name?.[0] || ""}`.toUpperCase()
                  : "??";

                const colors = [
                  "bg-amber-100 text-amber-700",
                  "bg-red-100 text-[#FF1F2D]",
                  "bg-emerald-100 text-emerald-700",
                  "bg-blue-100 text-blue-700",
                  "bg-indigo-100 text-indigo-700",
                ];
                const colorClass = colors[(log.customers?.first_name?.length || 0) % colors.length];

                const dateObj = new Date(log.created_at);
                const formattedDate = dateObj.toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "short",
                });
                const formattedTime = dateObj.toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs ${colorClass} shadow-xs border border-white shrink-0`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 text-sm truncate">
                          {clientName}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono">
                          {shortCode}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      {isRedeem ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <Gift size={12} /> CANJE DE PREMIO
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            log.method === "QR"
                              ? "bg-red-50 text-[#FF1F2D] border-red-100"
                              : "bg-blue-50 text-blue-700 border-blue-100"
                          }`}
                        >
                          <Star size={12} /> SELLO {log.method}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs font-semibold text-gray-700">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 border border-gray-200/60 max-w-[200px] truncate">
                        {log.businesses?.name || "Comercio"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="font-semibold text-xs text-gray-700">
                        {formattedDate}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {formattedTime} hs
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50/70 p-3.5 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500 font-medium">
        <span>Mostrando {filteredLogs.length} de {logs.length} registros recientes</span>
      </div>
    </div>
  );
}
