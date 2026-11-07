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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden flex flex-col">
      <div className="p-5 sm:p-6 border-b border-zinc-800 bg-zinc-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
              <Clock size={18} className="text-zinc-400" />
              Flujo de Actividad Reciente
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Últimas transacciones, sellos emitidos y canjes en todos los comercios.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="Buscar por cliente, código o comercio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-500 text-xs sm:text-sm rounded-xl pl-9 pr-4 py-2 focus:ring-1 focus:ring-white focus:border-white outline-none transition"
            />
          </div>
        </div>

        <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl p-1 w-full sm:w-auto self-start inline-flex">
          {["Todos", "Sellos", "Canjes"].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeFilter === f
                  ? "bg-white text-black"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-left font-medium min-w-[650px]">
          <thead className="bg-zinc-950 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800 font-medium">
            <tr>
              <th className="px-6 py-3.5 whitespace-nowrap">Cliente</th>
              <th className="px-6 py-3.5 whitespace-nowrap">Operación</th>
              <th className="px-6 py-3.5 whitespace-nowrap">Comercio</th>
              <th className="px-6 py-3.5 whitespace-nowrap text-right">Fecha y Hora</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 text-sm">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-xs text-zinc-500">
                  No se encontraron actividades con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isRedeem = log.method === "REDEEM";
                const clientName = log.customers
                  ? `${log.customers.first_name || ""} ${log.customers.last_name || ""}`.trim() || "Cliente"
                  : "Cliente";
                const shortCode = String(log.customers?.unique_code || "").replace(/^CLI\s*-\s*/i, "").trim() || "N/A";
                const initials = log.customers
                  ? `${log.customers.first_name?.[0] || "?"}${log.customers.last_name?.[0] || ""}`.toUpperCase()
                  : "??";

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
                  <tr key={log.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3 whitespace-nowrap">
                      <div className="h-9 w-9 rounded-full flex items-center justify-center font-semibold text-xs bg-zinc-950 text-zinc-200 border border-zinc-800 shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-white text-sm truncate">
                          {clientName}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          {shortCode}
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      {isRedeem ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Gift size={12} /> CANJE DE PREMIO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-zinc-950 text-zinc-200 border border-zinc-800">
                          <Star size={12} className="text-zinc-400" /> SELLO {log.method}
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs font-medium text-zinc-300 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-950 text-zinc-300 border border-zinc-800 max-w-[200px] truncate">
                        {log.businesses?.name || "Comercio"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="font-semibold text-xs text-white">
                        {formattedDate}
                      </div>
                      <div className="text-[11px] text-zinc-500">
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

      <div className="bg-zinc-950 p-3.5 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-500 font-medium">
        <span>Mostrando {filteredLogs.length} de {logs.length} registros recientes</span>
      </div>
    </div>
  );
}
