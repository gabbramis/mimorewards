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

export default async function AdminDashboardPage() {
  const supabase: any = createAdminClient();

  const graphEnd = new Date();
  const graphStart = new Date();
  graphStart.setDate(graphEnd.getDate() - 6);
  graphStart.setHours(0, 0, 0, 0);

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

  // Gráfico de afluencia de los últimos 7 días
  const daysMap: Record<string, { label: string; value: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(graphEnd);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}-${mm}-${dd}`;
    daysMap[dateKey] = {
      label: d.toLocaleDateString("es-AR", { weekday: "short" }),
      value: 0,
    };
  }

  (chartLogsData || []).forEach((log: any) => {
    const logDate = new Date(log.created_at);
    const yyyy = logDate.getFullYear();
    const mm = String(logDate.getMonth() + 1).padStart(2, "0");
    const dd = String(logDate.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}-${mm}-${dd}`;
    if (daysMap[dateKey]) {
      daysMap[dateKey].value++;
    }
  });

  const chartData = Object.keys(daysMap).map((k) => daysMap[k]);
  const maxChartValue = chartData.length > 0 ? Math.max(...chartData.map((d) => d.value)) : 0;
  const highestBar = maxChartValue > 0 ? maxChartValue : 1;
  const peakDay = chartData.length > 0 ? [...chartData].sort((a, b) => b.value - a.value)[0] : null;
  const totalChartStamps = chartData.reduce((acc, curr) => acc + curr.value, 0);
  const peakPercentage = peakDay && totalChartStamps > 0 ? Math.round((peakDay.value / totalChartStamps) * 100) : 0;

  const kpis = [
    {
      title: "Comercios Registrados",
      value: totalBusinesses.toLocaleString("es-AR"),
      subtitle: `${activeBusinesses} operativos`,
      icon: Store,
      iconBg: "bg-red-50 text-[#FF1F2D]",
    },
    {
      title: "Comercios Activos",
      value: activeBusinesses.toLocaleString("es-AR"),
      subtitle: `${totalBusinesses > 0 ? Math.round((activeBusinesses / totalBusinesses) * 100) : 0}% de operatividad`,
      icon: CheckCircle2,
      iconBg: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Clientes en Plataforma",
      value: totalCustomers.toLocaleString("es-AR"),
      subtitle: "Usuarios con tarjeta de fidelidad",
      icon: Users,
      iconBg: "bg-blue-50 text-blue-600",
    },
    {
      title: "Sellos Otorgados",
      value: totalStamps.toLocaleString("es-AR"),
      subtitle: "Interacciones acumuladas",
      icon: Stamp,
      iconBg: "bg-purple-50 text-purple-600",
    },
    {
      title: "Premios Canjeados",
      value: totalRedeems.toLocaleString("es-AR"),
      subtitle: "Recompensas entregadas",
      icon: Gift,
      iconBg: "bg-amber-50 text-amber-600",
    },
    {
      title: "Tasa de Retención",
      value: `${retentionRate}%`,
      subtitle: `${recurrentCustomers} clientes recurrentes`,
      icon: TrendingUp,
      iconBg: "bg-sky-50 text-sky-600",
    },
  ];

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto font-sans space-y-8">
      {/* Cabecera del Dashboard */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FF1F2D]">
              <TrendingUp size={14} />
              Panel Global
            </span>
            <span className="text-gray-300">·</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Datos en vivo
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Dashboard General
          </h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Métricas clave, tendencias de frecuencia y actividad global del ecosistema Mimo Rewards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/negocios"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 hover:text-gray-900"
          >
            <Building2 size={16} />
            <span>Ver Negocios</span>
          </Link>
          <Link
            href="/admin/crear-comercio"
            className="inline-flex items-center gap-2 rounded-xl bg-[#FF1F2D] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#e01826]"
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
                className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-xs transition hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    {kpi.title}
                  </span>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${kpi.iconBg}`}
                  >
                    <Icon size={18} strokeWidth={2.2} />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black tracking-tight text-gray-900">
                    {kpi.value}
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-gray-500 truncate">
                    {kpi.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Banner de Oportunidad de Retención */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between text-white shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-5 pointer-events-none w-72 h-72 -translate-y-12 translate-x-12">
          <Zap size={256} />
        </div>
        <div className="flex items-center gap-4 relative z-10 w-full mb-4 sm:mb-0">
          <div className="h-11 w-11 bg-white/10 rounded-2xl flex items-center justify-center shrink-0 border border-white/10">
            <Zap size={22} className="text-amber-400" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              Oportunidad de Retención Activa
            </h3>
            <p className="text-slate-300 text-xs mt-0.5">
              Hay <strong className="text-white font-bold">{readyToRedeem} clientes</strong> en la plataforma que ya alcanzaron o superaron 10 sellos y tienen premios listos para reclamar.
            </p>
          </div>
        </div>
        <Link
          href="/admin/contactos"
          className="relative z-10 whitespace-nowrap bg-white text-slate-900 hover:bg-gray-100 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 w-full sm:w-auto justify-center shrink-0"
        >
          <span>Ver Clientes en CRM</span>
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* 2. SECCIÓN INFERIOR: Gráficos de tendencias y cohortes */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Afluencia y Movimiento (7 días) */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-base font-bold text-gray-900 tracking-tight">
                  Afluencia y Movimiento Semanal
                </h2>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  Volumen de sellos otorgados en los últimos 7 días.
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-100 p-2 rounded-xl text-gray-400">
                <Activity size={18} />
              </div>
            </div>

            <div className="flex items-end justify-between gap-2 h-48 border-b border-gray-100 pb-2 relative">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
                <div className="w-full border-t border-gray-200 border-dashed" />
                <div className="w-full border-t border-gray-200 border-dashed" />
                <div className="w-full border-t border-gray-200 border-dashed" />
              </div>

              {chartData.map((d, index) => {
                const isZero = d.value === 0;
                const percentage = isZero ? 4 : Math.max((d.value / highestBar) * 100, 10);
                const isPeak = d.value > 0 && d.value === peakDay?.value;

                return (
                  <div key={index} className="flex flex-col items-center flex-1 group h-full z-10 w-full">
                    <div className="w-full h-full flex flex-col justify-end items-center relative gap-1.5 px-0.5">
                      <span
                        className={`text-[10px] sm:text-xs font-bold transition-opacity ${
                          isPeak ? "text-[#FF1F2D]" : isZero ? "text-gray-300" : "text-gray-500 group-hover:text-gray-800"
                        }`}
                      >
                        {d.value}
                      </span>
                      <div
                        className={`w-full max-w-[42px] rounded-t-lg transition-all duration-500 ease-out border-t ${
                          isZero
                            ? "bg-gray-100 border-gray-200"
                            : isPeak
                            ? "bg-[#FF1F2D] border-red-700 hover:bg-[#e01826] shadow-xs"
                            : "bg-red-100 border-red-200 hover:bg-red-200"
                        }`}
                        style={{ height: `${percentage}%` }}
                        title={`${d.value} sellos el ${d.label}`}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-bold mt-2 uppercase tracking-wider ${
                        isPeak ? "text-[#FF1F2D]" : "text-gray-400"
                      }`}
                    >
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center gap-3">
            <div className="text-[#FF1F2D] bg-white p-1.5 rounded-lg shadow-xs border border-gray-100">
              <Star size={14} />
            </div>
            <p className="text-xs text-gray-600 font-medium">
              Día con mayor afluencia: <strong className="text-gray-900">{peakDay?.label || "N/A"}</strong> ({peakDay?.value || 0} sellos, representa el <strong className="text-[#FF1F2D]">{peakPercentage}%</strong> de la semana).
            </p>
          </div>
        </div>

        {/* Fidelidad y Distribución de Cohortes */}
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-base font-bold text-gray-900 tracking-tight">
                  Fidelidad y Cohortes de Clientes
                </h2>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  Distribución de la base global de usuarios por frecuencia de visita.
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-100 p-2 rounded-xl text-gray-400">
                <Award size={18} />
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
                    Nivel 1
                    <span className="text-[10px] font-medium text-gray-500 px-1.5 py-0.5 bg-gray-100 rounded">
                      1–2 visitas
                    </span>
                  </h4>
                  <span className="text-xs font-bold text-gray-900">{l1Pct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className="bg-gray-400 h-2.5 rounded-full" style={{ width: `${l1Pct}%` }} />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 font-medium flex justify-between">
                  <span>{cohortL1} clientes</span>
                  <span className="text-amber-600 font-semibold">Ocasionales</span>
                </p>
              </div>

              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <h4 className="text-xs font-bold text-gray-800 flex items-center gap-2">
                    Nivel 2
                    <span className="text-[10px] font-medium text-gray-500 px-1.5 py-0.5 bg-gray-100 rounded">
                      3–5 visitas
                    </span>
                  </h4>
                  <span className="text-xs font-bold text-gray-900">{l2Pct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${l2Pct}%` }} />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 font-medium">
                  {cohortL2} clientes con hábito de compra recurrente
                </p>
              </div>

              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <h4 className="text-xs font-bold text-[#FF1F2D] flex items-center gap-2">
                    Frecuentes VIP
                    <span className="text-[10px] font-bold text-[#FF1F2D] px-1.5 py-0.5 bg-red-50 border border-red-200/60 rounded flex items-center gap-1">
                      <Star size={10} /> 6+ visitas
                    </span>
                  </h4>
                  <span className="text-xs font-black text-[#FF1F2D]">{l3Pct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className="bg-gradient-to-r from-[#FF1F2D] to-rose-600 h-2.5 rounded-full" style={{ width: `${l3Pct}%` }} />
                </div>
                <p className="text-[10px] text-gray-500 mt-1 font-medium">
                  {cohortL3} clientes leales de alta frecuencia
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/admin/contactos"
            className="mt-5 text-xs font-semibold text-[#FF1F2D] hover:underline border-t border-gray-100 pt-3 flex items-center justify-center gap-1"
          >
            Ver listado de clientes en CRM <ChevronRight size={14} />
          </Link>
        </div>
      </section>

      {/* 3. FLUIDO DE ACTIVIDAD RECIENTE (Interactiva) */}
      <DashboardActivityFeed logs={recentLogs} />

      {/* 4. ÚLTIMOS COMERCIOS CREADOS */}
      <section
        aria-labelledby="recent-businesses-title"
        className="rounded-2xl border border-gray-200 bg-white shadow-xs overflow-hidden"
      >
        <div className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100">
          <div>
            <h2
              id="recent-businesses-title"
              className="text-lg font-bold text-gray-900 tracking-tight"
            >
              Últimos Comercios Creados
            </h2>
            <p className="text-xs font-medium text-gray-500 mt-0.5">
              Los negocios registrados más recientemente en la plataforma.
            </p>
          </div>
          <Link
            href="/admin/negocios"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF1F2D] hover:underline"
          >
            <span>Ver todos los negocios</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        {recentBusinesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-[#FF1F2D] mb-3">
              <Store size={28} />
            </div>
            <p className="font-semibold text-gray-900">No hay comercios registrados</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
              Aún no se ha dado de alta ningún comercio en la base de datos.
            </p>
            <Link
              href="/admin/crear-comercio"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#FF1F2D] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#e01826]"
            >
              <Plus size={14} />
              <span>Crear el primero</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-gray-400 text-xs uppercase tracking-wider font-bold">
                  <th className="px-6 py-3.5">Comercio</th>
                  <th className="px-6 py-3.5">Fecha de Alta</th>
                  <th className="px-6 py-3.5">Estado</th>
                  <th className="px-6 py-3.5 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentBusinesses.map((business) => (
                  <tr
                    key={business.id}
                    className="hover:bg-gray-50/70 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {business.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={business.logo_url}
                            alt={`Logo de ${business.name}`}
                            className="h-10 w-10 shrink-0 rounded-xl border border-gray-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-xs font-extrabold text-[#FF1F2D]">
                            {getInitials(business.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-sm text-gray-900">
                            {business.name}
                          </p>
                          <p className="text-xs font-mono text-gray-400">
                            ID: {business.id.slice(0, 8)}…
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-xs font-medium text-gray-600">
                      <div className="inline-flex items-center gap-1.5">
                        <Calendar size={13} className="text-gray-400" />
                        <span>{formatDate(business.created_at)}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                          business.active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            business.active ? "bg-emerald-500" : "bg-gray-400"
                          }`}
                        />
                        {business.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/negocios/${business.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-[#FF1F2D] transition-colors"
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
