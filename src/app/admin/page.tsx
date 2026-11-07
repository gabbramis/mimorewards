import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Store,
  CheckCircle2,
  Users,
  Stamp,
  ArrowUpRight,
  Plus,
  Calendar,
  Building2,
  ChevronRight,
  TrendingUp,
  Gift,
  Star,
  Activity,
  Award,
  Zap,
} from "lucide-react";
import { DashboardActivityFeed, type ActivityLog } from "@/components/admin/DashboardActivityFeed";

export const dynamic = "force-dynamic";

type BusinessSummary = {
  id: string;
  name: string;
  logo_url: string | null;
  active: boolean;
  created_at: string | null;
};

function formatDate(dateString?: string | null): string {
  if (!dateString) return "Fecha no registrada";
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return dateString;
  }
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CHART_TIME_ZONE = "America/Montevideo";
const WEEK_LABELS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"] as const;
const WEEKDAY_TO_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CHART_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const weekdayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: CHART_TIME_ZONE, weekday: "short" });
const shortDateFormatter = new Intl.DateTimeFormat("es-UY", { timeZone: CHART_TIME_ZONE, day: "2-digit", month: "2-digit" });

type WeeklyChartPoint = { label: string; value: number; dateLabel: string };

/**
 * Construye la data del gráfico semanal sobre un molde fijo LUN→DOM.
 * Toma los últimos 7 días (hoy incluido, zona horaria de Uruguay) y ubica cada
 * día en el índice de su día de la semana (Lunes = 0 … Domingo = 6).
 */
function buildWeeklyChartData(logs: { created_at: string }[], now: Date): WeeklyChartPoint[] {
  // 1. Esqueleto fijo
  const skeleton: WeeklyChartPoint[] = WEEK_LABELS.map((label) => ({ label, value: 0, dateLabel: "" }));

  // 2. Franja "Últimos 7 días": cada fecha → su posición en el molde
  const dateKeyToIndex = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    const day = new Date(now.getTime() - i * DAY_MS);
    const index = WEEKDAY_TO_INDEX[weekdayFormatter.format(day)];
    if (index === undefined) continue;
    dateKeyToIndex.set(dateKeyFormatter.format(day), index);
    skeleton[index].dateLabel = shortDateFormatter.format(day);
  }

  // 3. Rellenar el molde con los registros agrupados por día
  for (const log of logs) {
    const index = dateKeyToIndex.get(dateKeyFormatter.format(new Date(log.created_at)));
    if (index !== undefined) skeleton[index].value++;
  }

  return skeleton;
}

export default async function AdminDashboardPage() {
  const supabase: any = createAdminClient();

  const graphEnd = new Date();
  // Margen de 8 días para cubrir la diferencia horaria con America/Montevideo;
  // el filtrado exacto de los últimos 7 días se hace en buildWeeklyChartData.
  const graphStart = new Date(graphEnd.getTime() - 8 * DAY_MS);

  // Consultas concurrentes consolidadas en paralelo a Supabase
  const [
    { count: totalBusinessesCount },
    { count: activeBusinessesCount },
    { count: totalCustomersCount },
    { count: totalStampsCount },
    { count: totalRedeemsCount },
    { data: customersStatsData },
    { data: recentBusinessesData },
    { data: recentLogsData },
    { data: chartLogsData },
  ] = await Promise.all([
    supabase.from("businesses").select("*", { count: "exact", head: true }),
    supabase.from("businesses").select("*", { count: "exact", head: true }).eq("active", true),
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("stamp_logs").select("*", { count: "exact", head: true }).neq("method", "REDEEM"),
    supabase.from("stamp_logs").select("*", { count: "exact", head: true }).eq("method", "REDEEM"),
    supabase.from("customers").select("current_stamps, total_visits"),
    supabase.from("businesses").select("id, name, logo_url, active, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("stamp_logs").select(`
      id, method, created_at, business_id,
      customers ( first_name, last_name, unique_code ),
      businesses ( name )
    `).order("created_at", { ascending: false }).limit(40),
    supabase.from("stamp_logs").select("created_at, method")
      .gte("created_at", graphStart.toISOString())
      .neq("method", "REDEEM"),
  ]);

  const totalBusinesses = totalBusinessesCount ?? 0;
  const activeBusinesses = activeBusinessesCount ?? 0;
  const totalCustomers = totalCustomersCount ?? 0;
  const totalStamps = totalStampsCount ?? 0;
  const totalRedeems = totalRedeemsCount ?? 0;
  const recentBusinesses = (recentBusinessesData ?? []) as BusinessSummary[];
  const recentLogs = (recentLogsData ?? []) as ActivityLog[];

  // Cálculos de clientes, retención y cohortes
  const allCustomers = customersStatsData || [];
  let readyToRedeem = 0;
  let recurrentCustomers = 0;
  let cohortL1 = 0; // 1-2 visitas
  let cohortL2 = 0; // 3-5 visitas
  let cohortL3 = 0; // 6+ visitas

  allCustomers.forEach((c: any) => {
    const visits = c.total_visits || 0;
    if ((c.current_stamps || 0) >= 10) readyToRedeem++;
    if (visits > 1) recurrentCustomers++;

    if (visits <= 2) cohortL1++;
    else if (visits <= 5) cohortL2++;
    else cohortL3++;
  });

  const totalCustomersCalculated = allCustomers.length || totalCustomers || 1;
  const retentionRate = totalCustomers > 0 ? Math.round((recurrentCustomers / totalCustomersCalculated) * 100) : 0;
  const l1Pct = Math.round((cohortL1 / totalCustomersCalculated) * 100) || 45;
  const l2Pct = Math.round((cohortL2 / totalCustomersCalculated) * 100) || 35;
  const l3Pct = Math.round((cohortL3 / totalCustomersCalculated) * 100) || 20;

  // Gráfico de afluencia: esqueleto FIJO de Lunes a Domingo (izquierda → derecha),
  // independientemente del día actual. Los datos de los últimos 7 días se ubican
  // en la posición de su día de la semana (cada día aparece exactamente una vez).
  const chartData = buildWeeklyChartData(chartLogsData || [], graphEnd);
  const maxChartValue = chartData.length > 0 ? Math.max(...chartData.map((d) => d.value)) : 0;
  const peakDay = chartData.length > 0 ? [...chartData].sort((a, b) => b.value - a.value)[0] : null;
  const totalChartStamps = chartData.reduce((acc, curr) => acc + curr.value, 0);
  const peakPercentage = peakDay && totalChartStamps > 0 ? Math.round((peakDay.value / totalChartStamps) * 100) : 0;

  const kpis = [
    {
      title: "Comercios Registrados",
      value: totalBusinesses.toLocaleString("es-AR"),
      subtitle: `${activeBusinesses} operativos`,
      icon: Store,
    },
    {
      title: "Comercios Activos",
      value: activeBusinesses.toLocaleString("es-AR"),
      subtitle: `${totalBusinesses > 0 ? Math.round((activeBusinesses / totalBusinesses) * 100) : 0}% de operatividad`,
      icon: CheckCircle2,
    },
    {
      title: "Clientes en Plataforma",
      value: totalCustomers.toLocaleString("es-AR"),
      subtitle: "Usuarios con tarjeta de fidelidad",
      icon: Users,
    },
    {
      title: "Sellos Otorgados",
      value: totalStamps.toLocaleString("es-AR"),
      subtitle: "Interacciones acumuladas",
      icon: Stamp,
    },
    {
      title: "Premios Canjeados",
      value: totalRedeems.toLocaleString("es-AR"),
      subtitle: "Recompensas entregadas",
      icon: Gift,
    },
    {
      title: "Tasa de Retención",
      value: `${retentionRate}%`,
      subtitle: `${recurrentCustomers} clientes recurrentes`,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto font-sans space-y-6 md:space-y-8">
      {/* Cabecera del Dashboard */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400">
              <TrendingUp size={14} className="text-zinc-400" />
              Panel Global
            </span>
            <span className="text-zinc-700">·</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-900 text-emerald-400 border border-zinc-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Datos en vivo
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">
            Dashboard General
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Métricas clave, tendencias de frecuencia y actividad global del ecosistema Mimo Rewards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/negocios"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 hover:text-white"
          >
            <Building2 size={16} />
            <span>Ver Negocios</span>
          </Link>
          <Link
            href="/admin/crear-comercio"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-gray-200"
          >
            <Plus size={16} />
            <span>Nuevo Negocio</span>
          </Link>
        </div>
      </div>

      {/* 1. SECCIÓN SUPERIOR: Tarjetas de resumen rápido / KPIs */}
      <section aria-labelledby="kpis-title">
        <h2 id="kpis-title" className="sr-only">
          Indicadores clave de rendimiento
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.title}
                className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    {kpi.title}
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400">
                    <Icon size={16} strokeWidth={2} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-semibold tracking-tight text-white">
                    {kpi.value}
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500 truncate">
                    {kpi.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Banner de Oportunidad de Retención */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between text-white">
        <div className="flex items-center gap-4 w-full mb-4 sm:mb-0">
          <div className="h-11 w-11 bg-zinc-950 rounded-xl flex items-center justify-center shrink-0 border border-zinc-800">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              Oportunidad de Retención Activa
            </h3>
            <p className="text-zinc-400 text-xs mt-0.5">
              Hay <strong className="text-white font-semibold">{readyToRedeem} clientes</strong> en la plataforma que ya alcanzaron o superaron 10 sellos y tienen premios listos para reclamar.
            </p>
          </div>
        </div>
        <Link
          href="/admin/contactos"
          className="whitespace-nowrap bg-white text-black hover:bg-gray-200 px-4 py-2.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 w-full sm:w-auto justify-center shrink-0"
        >
          <span>Ver Clientes en CRM</span>
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* 2. SECCIÓN INFERIOR: Gráficos de tendencias y cohortes */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Afluencia y Movimiento (7 días) */}
        <div className="bg-zinc-900 p-5 md:p-6 rounded-2xl border border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-base font-semibold text-white tracking-tight">
                  Afluencia y Movimiento Semanal
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Volumen de sellos otorgados en los últimos 7 días, ordenado de lunes a domingo.
                </p>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 p-2 rounded-xl text-zinc-400">
                <Activity size={18} />
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 sm:gap-3 border-b border-zinc-800 pb-2">
              {chartData.map((d) => {
                const isZero = d.value === 0;
                // Altura relativa al máximo de la semana (0% si no hubo movimiento)
                const heightPercent = maxChartValue > 0 ? (d.value / maxChartValue) * 100 : 0;
                const isPeak = d.value > 0 && d.value === peakDay?.value;

                return (
                  <div key={d.label} className="group flex min-w-0 flex-col items-center gap-1.5">
                    <span
                      className={`text-[10px] sm:text-xs font-semibold ${
                        isPeak ? "text-white" : isZero ? "text-zinc-600" : "text-zinc-400 group-hover:text-white"
                      }`}
                    >
                      {d.value}
                    </span>

                    {/* Contenedor con altura fija y sin fondo gris */}
                    <div
                      className="relative h-40 w-full max-w-[42px] flex flex-col justify-end"
                      title={`${d.value} sellos el ${d.label}${d.dateLabel ? ` (${d.dateLabel})` : ""}`}
                    >
                      <div
                        className="w-full bg-white rounded-t-sm transition-all duration-500"
                        style={{
                          height: maxChartValue > 0 ? `${(d.value / maxChartValue) * 100}%` : "0%",
                          minHeight: d.value > 0 ? "4px" : "0px",
                          opacity: d.value > 0 ? 1 : 0,
                        }}
                      />
                    </div>

                    <span
                      className={`mt-1 text-[10px] font-medium uppercase tracking-wider ${
                        isPeak ? "text-white font-semibold" : "text-zinc-500"
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 bg-zinc-950 rounded-xl p-3 border border-zinc-800 flex items-center gap-3">
            <div className="text-zinc-300 bg-zinc-900 p-1.5 rounded-lg border border-zinc-800">
              <Star size={14} />
            </div>
            <p className="text-xs text-zinc-400">
              Día con mayor afluencia: <strong className="text-white font-semibold">{peakDay?.label || "N/A"}</strong> ({peakDay?.value || 0} sellos, representa el <strong className="text-white font-semibold">{peakPercentage}%</strong> de la semana).
            </p>
          </div>
        </div>

        {/* Fidelidad y Distribución de Cohortes */}
        <div className="bg-zinc-900 p-5 md:p-6 rounded-2xl border border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-base font-semibold text-white tracking-tight">
                  Fidelidad y Cohortes de Clientes
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Distribución de la base global de usuarios por frecuencia de visita.
                </p>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 p-2 rounded-xl text-zinc-400">
                <Award size={18} />
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                    Nivel 1
                    <span className="text-[10px] font-medium text-zinc-400 px-1.5 py-0.5 bg-zinc-950 border border-zinc-800 rounded">
                      1–2 visitas
                    </span>
                  </h4>
                  <span className="text-xs font-semibold text-white">{l1Pct}%</span>
                </div>
                <div className="w-full bg-zinc-950 border border-zinc-800 rounded-full h-2">
                  <div className="bg-zinc-600 h-full rounded-full" style={{ width: `${l1Pct}%` }} />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 flex justify-between">
                  <span>{cohortL1} clientes</span>
                  <span className="text-zinc-400 font-medium">Ocasionales</span>
                </p>
              </div>

              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                    Nivel 2
                    <span className="text-[10px] font-medium text-zinc-400 px-1.5 py-0.5 bg-zinc-950 border border-zinc-800 rounded">
                      3–5 visitas
                    </span>
                  </h4>
                  <span className="text-xs font-semibold text-white">{l2Pct}%</span>
                </div>
                <div className="w-full bg-zinc-950 border border-zinc-800 rounded-full h-2">
                  <div className="bg-zinc-400 h-full rounded-full" style={{ width: `${l2Pct}%` }} />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {cohortL2} clientes con hábito de compra recurrente
                </p>
              </div>

              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                    Frecuentes VIP
                    <span className="text-[10px] font-medium text-white px-1.5 py-0.5 bg-zinc-950 border border-zinc-700 rounded flex items-center gap-1">
                      <Star size={10} /> 6+ visitas
                    </span>
                  </h4>
                  <span className="text-xs font-semibold text-white">{l3Pct}%</span>
                </div>
                <div className="w-full bg-zinc-950 border border-zinc-800 rounded-full h-2">
                  <div className="bg-white h-full rounded-full" style={{ width: `${l3Pct}%` }} />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  {cohortL3} clientes leales de alta frecuencia
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/admin/contactos"
            className="mt-5 text-xs font-medium text-zinc-300 hover:text-white border-t border-zinc-800 pt-3 flex items-center justify-center gap-1 transition-colors"
          >
            Ver listado de clientes en CRM <ChevronRight size={14} />
          </Link>
        </div>
      </section>

      {/* 3. FLUJO DE ACTIVIDAD RECIENTE (Interactiva) */}
      <DashboardActivityFeed logs={recentLogs} />

      {/* 4. ÚLTIMOS COMERCIOS CREADOS */}
      <section
        aria-labelledby="recent-businesses-title"
        className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden"
      >
        <div className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800">
          <div>
            <h2
              id="recent-businesses-title"
              className="text-lg font-semibold text-white tracking-tight"
            >
              Últimos Comercios Creados
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Los negocios registrados más recientemente en la plataforma.
            </p>
          </div>
          <Link
            href="/admin/negocios"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <span>Ver todos los negocios</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {recentBusinesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 text-zinc-400 mb-3">
              <Store size={28} />
            </div>
            <p className="font-semibold text-white">No hay comercios registrados</p>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs">
              Aún no se ha dado de alta ningún comercio en la base de datos.
            </p>
            <Link
              href="/admin/crear-comercio"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-gray-200 transition"
            >
              <Plus size={14} />
              <span>Crear el primero</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wider font-medium">
                  <th className="px-6 py-3.5 whitespace-nowrap">Comercio</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Fecha de Alta</th>
                  <th className="px-6 py-3.5 whitespace-nowrap">Estado</th>
                  <th className="px-6 py-3.5 whitespace-nowrap text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {recentBusinesses.map((business) => (
                  <tr
                    key={business.id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {business.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={business.logo_url}
                            alt={`Logo de ${business.name}`}
                            className="h-10 w-10 shrink-0 rounded-xl border border-zinc-800 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-semibold text-white">
                            {getInitials(business.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-sm text-white">
                            {business.name}
                          </p>
                          <p className="text-xs font-mono text-zinc-500">
                            ID: {business.id.slice(0, 8)}…
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs text-zinc-400 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Calendar size={13} className="text-zinc-500" />
                        <span>{formatDate(business.created_at)}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${
                          business.active
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-950 text-zinc-400 border-zinc-800"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            business.active ? "bg-emerald-400" : "bg-zinc-500"
                          }`}
                        />
                        {business.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/negocios/${business.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                        title="Editar comercio"
                      >
                        <span>Gestionar</span>
                        <ArrowUpRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
