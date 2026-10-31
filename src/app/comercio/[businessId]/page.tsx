import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Stamp,
  Gift,
  ArrowRight,
  Clock,
  Smartphone,
  Edit3,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import CounterQrCard from "@/components/merchant/CounterQrCard";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ businessId: string }>;
}

function formatDate(dateStr: string) {
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

export default async function MerchantDashboardPage({ params }: PageProps) {
  const { businessId } = await params;
  const supabase: any = createAdminClient();

  // Fechas de filtro
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Semana actual: Lunes como primer día y Domingo como último día
  const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);

  // Consultas concurrentes filtradas estrictamente por businessId
  const [
    { data: business },
    { count: totalCustomersCount, data: customersData },
    { count: stampsTodayCount },
    { count: stampsWeekCount },
    { count: totalRedeemsCount },
    { data: recentLogsData },
    { data: chartLogsData },
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, name, reward_target, reward_description, primary_color, active, slug, plan_type")
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("customers")
      .select("id, total_visits, current_stamps, last_visit_at, created_at", { count: "exact" })
      .eq("business_id", businessId),
    supabase
      .from("stamp_logs")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .neq("method", "REDEEM")
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("stamp_logs")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .neq("method", "REDEEM")
      .gte("created_at", weekStart.toISOString()),
    supabase
      .from("stamp_logs")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("method", "REDEEM"),
    supabase
      .from("stamp_logs")
      .select(`
        id,
        created_at,
        method,
        metadata,
        customers (
          first_name,
          last_name,
          phone,
          unique_code
        )
      `)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("stamp_logs")
      .select("created_at, method")
      .eq("business_id", businessId)
      .gte("created_at", weekStart.toISOString()),
  ]);

  if (!business) {
    notFound();
  }

  const customersList = customersData || [];
  // 1. Clientes activos: total de clientes únicos asociados a este businessId
  const totalCustomers = Math.max(
    typeof totalCustomersCount === "number" ? totalCustomersCount : 0,
    customersList.length
  );

  const stampsToday = stampsTodayCount || 0;
  const stampsWeek = stampsWeekCount || 0;
  const totalRedeems = totalRedeemsCount || 0;

  // 2. Clientes inactivos: cuya last_visit_at sea igual o mayor a 25 días atrás
  const TWENTY_FIVE_DAYS_MS = 25 * 24 * 60 * 60 * 1000;
  const inactiveCustomers = customersList.filter((c: any) => {
    const visitDate = c.last_visit_at || c.created_at;
    if (!visitDate) return false;
    const diffMs = now.getTime() - new Date(visitDate).getTime();
    return diffMs >= TWENTY_FIVE_DAYS_MS;
  }).length;

  // 3. Tasa de retorno: (clientes_recurrentes / clientes_totales) * 100
  // Si hay 1 cliente en total y tiene más de 1 visita, debe mostrar 100%, no 0.0%
  const recurrentCustomers = customersList.filter(
    (c: any) => Number(c.total_visits || 0) > 1
  ).length;

  const returnRateRaw =
    totalCustomers > 0 ? (recurrentCustomers / totalCustomers) * 100 : 0;
  const returnRate =
    returnRateRaw % 1 === 0 ? returnRateRaw.toFixed(0) : returnRateRaw.toFixed(1);

  // Agrupación por día de la semana para el gráfico: siempre Lunes primero hasta Domingo el último
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const daysMap: { [key: string]: { label: string; count: number; date: Date; isToday: boolean } } = {};

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    daysMap[key] = { label: dayNames[i], count: 0, date: d, isToday };
  }

  (chartLogsData || []).forEach((log: any) => {
    if (log.created_at) {
      const d = new Date(log.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (daysMap[key]) {
        daysMap[key].count += 1;
      }
    }
  });

  const chartDays = Object.values(daysMap);
  const maxDayCount = Math.max(...chartDays.map((d) => d.count), 1);

  // URL del QR del mostrador (siempre apunta al dominio de producción)
  const qrUrl = `https://mimorewards.com/t/${business.slug || business.id}`;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#737373]">
            Resumen Operativo
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-[#1F1F1F]">
            Dashboard
          </h2>
          <p className="text-xs text-[#737373] mt-0.5">
            Métricas de fidelización en tiempo real para {business.name}.
          </p>
        </div>
      </div>

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* Card 1: Sellos Entregados */}
        <div className="rounded-2xl border border-[#D5CFC4] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <span className="text-xs font-semibold text-[#737373]">
            Sellos entregados
          </span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#1F1F1F] tracking-tight">
              {stampsWeek}{" "}
              <span className="text-xs font-medium text-[#737373]">
                esta semana
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-[#737373]">
              <span className="inline-flex items-center font-semibold text-[#10B981] bg-[#ECFDF5] px-2 py-0.5 rounded-full text-[11px]">
                {stampsToday} hoy
              </span>
              <span>acreditados</span>
            </div>
          </div>
        </div>

        {/* Card 2: Premios Canjeados */}
        <div className="rounded-2xl border border-[#D5CFC4] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <span className="text-xs font-semibold text-[#737373]">
            Premios canjeados
          </span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#1F1F1F] tracking-tight">
              {totalRedeems}
            </div>
            <p className="mt-2 text-xs text-[#737373] truncate">
              Premio activo: {business.reward_description || "Recompensa activa"}
            </p>
          </div>
        </div>

        {/* Card 3: Clientes Activos */}
        <div className="rounded-2xl border border-[#D5CFC4] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <span className="text-xs font-semibold text-[#737373]">
            Clientes activos
          </span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#1F1F1F] tracking-tight">
              {business.plan_type === "inicial" ? (
                <>
                  <span className="text-xs font-medium text-[#737373]">Clientes: </span>
                  {totalCustomers}
                  <span className="text-xs font-medium text-[#737373]"> / 100 (Plan Inicial)</span>
                </>
              ) : (
                totalCustomers
              )}
            </div>
            <p className="mt-2 text-xs text-[#737373]">
              Registrados en esta sucursal
            </p>
          </div>
        </div>

        {/* Card 4: Clientes Inactivos */}
        <div className="rounded-2xl border border-[#D5CFC4] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <span className="text-xs font-semibold text-[#737373]">
            Clientes inactivos
          </span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#1F1F1F] tracking-tight">
              {inactiveCustomers}
            </div>
            <p className="mt-2 text-xs text-[#737373]">
              Sin visitas hace 25+ días
            </p>
          </div>
        </div>

        {/* Card 5: Tasa de Retorno */}
        <div className="rounded-2xl border border-[#D5CFC4] bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
          <span className="text-xs font-semibold text-[#737373]">
            Tasa de retorno
          </span>
          <div className="mt-3">
            <div className="text-2xl font-bold text-[#1F1F1F] tracking-tight">
              {returnRate}%
            </div>
            <p className="mt-2 text-xs text-[#737373]">
              {recurrentCustomers} {recurrentCustomers === 1 ? "cliente" : "clientes"} con más de 1 visita
            </p>
          </div>
        </div>
      </div>

      {/* Gráfico de Actividad Semanal & QR del Mostrador */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          {/* Gráfico de Actividad Semanal */}
          <div className="h-full flex flex-col justify-between rounded-2xl border border-[#D5CFC4] bg-white p-4 sm:p-6 shadow-xs">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
              <div>
                <h3 className="text-base font-bold text-[#1F1F1F] tracking-tight">
                  Actividad semanal
                </h3>
                <p className="text-xs text-[#737373] mt-0.5">
                  Volumen de sellos y visitas por día de la semana.
                </p>
              </div>
              <span className="rounded-full bg-[#FFF9F5] border border-[#D5CFC4] px-3 py-1 text-[11px] font-semibold text-[#737373]">
                Lunes a Domingo
              </span>
            </div>

            {/* Bar Chart */}
            <div className="mt-6 flex h-48 items-end justify-between gap-1.5 sm:gap-3 pt-6 sm:px-2">
              {chartDays.map((item, idx) => {
                const heightPercent = Math.max(
                  Math.round((item.count / maxDayCount) * 100),
                  6
                );
                const isToday = item.isToday;
                const isPeak = item.count === maxDayCount && maxDayCount > 0;

                return (
                  <div
                    key={idx}
                    className="group flex flex-1 flex-col items-center gap-2 h-full justify-end"
                  >
                    <span className="text-[11px] font-bold text-[#1F1F1F] opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.count}
                    </span>
                    <div className="w-full max-w-[40px] flex items-end justify-center h-full">
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t-xl transition-all duration-300 ${
                          isPeak
                            ? "bg-[#FF1F2D] shadow-sm"
                            : isToday
                            ? "bg-[#FF7A85]"
                            : "bg-[#FAD9DC] group-hover:bg-[#FF7A85]"
                        }`}
                      />
                    </div>
                    <span
                      className={`text-[11px] font-semibold ${
                        isToday ? "text-[#FF1F2D]" : "text-[#737373]"
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-[#D5CFC4] flex flex-wrap gap-2 items-center justify-between text-xs text-[#737373]">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-[#FF1F2D]" />
                Día con más visitas
              </span>
              <span>Total semanal: {stampsWeek} movimientos</span>
            </div>
          </div>
        </div>

        <div className="xl:col-span-1">
          {/* Tu QR para el mostrador */}
          <CounterQrCard
            businessId={business.id}
            businessSlug={business.slug}
            businessName={business.name}
            qrUrl={qrUrl}
          />
        </div>
      </div>

      {/* Resumen Rápido: Últimos 5 Movimientos */}
      <div className="rounded-2xl border border-[#D5CFC4] bg-white p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#1F1F1F] tracking-tight">
              Últimos 5 movimientos
            </h3>
            <p className="text-xs text-[#737373] mt-0.5">
              Transacciones recientes registradas en este local.
            </p>
          </div>
          <Link
            href={`/comercio/${businessId}/historial`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF1F2D] hover:underline"
          >
            Ver historial completo
            <ArrowRight size={13} />
          </Link>
        </div>

        {recentLogsData && recentLogsData.length > 0 ? (
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-[#D5CFC4] text-[#737373]">
                  <th className="pb-3 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">
                    Fecha y Hora
                  </th>
                  <th className="pb-3 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">
                    Cliente
                  </th>
                  <th className="pb-3 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">
                    Acción
                  </th>
                  <th className="pb-3 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">
                    Método
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5CFC4]">
                {recentLogsData.map((log: any) => {
                  const customer = log.customers;
                  const isRedeem = log.method === "REDEEM";
                  const isNfc = log.method === "NFC";
                  const clientName = customer
                    ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
                      customer.phone ||
                      "Cliente"
                    : "Cliente";

                  return (
                    <tr key={log.id} className="hover:bg-[#FFF9F5] transition-colors">
                      <td className="py-3.5 pr-4 text-[#737373] whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Clock size={13} className="text-[#A3A3A3]" />
                          {formatDate(log.created_at)}
                        </span>
                      </td>
                      <td className="py-3.5 pr-4 font-semibold text-[#1F1F1F] whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-[#FFF0F1] text-[#FF1F2D] font-bold text-[10px] flex items-center justify-center shrink-0">
                            {clientName.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="leading-tight">{clientName}</p>
                            {customer?.unique_code && (
                              <p className="text-[10px] text-[#737373]">
                                {String(customer.unique_code || "").replace(/^CLI\s*-\s*/i, "").trim()}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 whitespace-nowrap">
                        {isRedeem ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0F1] px-2.5 py-1 text-[11px] font-semibold text-[#FF1F2D] border border-[#FFD9DC]">
                            <Gift size={12} />
                            Premio canjeado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-1 text-[11px] font-semibold text-[#10B981] border border-[#A7F3D0]">
                            <Stamp size={12} />
                            +1 Sello acreditado
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-[#737373] whitespace-nowrap">
                        {isNfc ? (
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <Smartphone size={13} className="text-[#0284C7]" />
                            NFC / Autoservicio
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <Edit3 size={13} className="text-[#737373]" />
                            Carga manual
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 text-center">
            <Clock size={28} className="mx-auto text-[#D4D4D4] mb-2" />
            <p className="text-sm font-semibold text-[#1F1F1F]">
              Aún no hay movimientos registrados
            </p>
            <p className="text-xs text-[#737373] mt-1">
              Los sellos y canjes que se registren en caja aparecerán aquí.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
