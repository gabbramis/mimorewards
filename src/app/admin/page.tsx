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
} from "lucide-react";

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

  // Consultas concurrentes en paralelo a la base de datos de Supabase
  const [
    { count: totalBusinessesCount },
    { count: activeBusinessesCount },
    { count: totalCustomersCount },
    { count: totalStampsCount },
    { data: recentBusinessesData },
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("businesses")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("stamp_logs")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("businesses")
      .select("id, name, logo_url, active, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const totalBusinesses = totalBusinessesCount ?? 0;
  const activeBusinesses = activeBusinessesCount ?? 0;
  const totalCustomers = totalCustomersCount ?? 0;
  const totalStamps = totalStampsCount ?? 0;
  const recentBusinesses = (recentBusinessesData ?? []) as BusinessSummary[];

  const kpis = [
    {
      title: "Comercios Registrados",
      value: totalBusinesses.toLocaleString("es-AR"),
      subtitle: "Total histórico en plataforma",
      icon: Store,
      iconBg: "bg-red-50 text-[#FF1F2D]",
    },
    {
      title: "Comercios Activos",
      value: activeBusinesses.toLocaleString("es-AR"),
      subtitle: `${totalBusinesses > 0 ? Math.round((activeBusinesses / totalBusinesses) * 100) : 0}% operativos`,
      icon: CheckCircle2,
      iconBg: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Total de Clientes",
      value: totalCustomers.toLocaleString("es-AR"),
      subtitle: "Usuarios con tarjeta de lealtad",
      icon: Users,
      iconBg: "bg-blue-50 text-blue-600",
    },
    {
      title: "Sellos Entregados",
      value: totalStamps.toLocaleString("es-AR"),
      subtitle: "Registros en stamp_logs",
      icon: Stamp,
      iconBg: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto font-sans space-y-8">
      {/* Cabecera del Dashboard */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF1F2D] mb-1">
            <TrendingUp size={15} />
            <span>Panel Global · Superadmin</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Dashboard General
          </h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Métricas en tiempo real y actividad reciente del ecosistema Mimo Rewards.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/negocios"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-gray-900"
          >
            <Building2 size={16} />
            <span>Ver Negocios</span>
          </Link>
          <Link
            href="/admin/crear-comercio"
            className="inline-flex items-center gap-2 rounded-xl bg-[#FF1F2D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e01826]"
          >
            <Plus size={16} />
            <span>Nuevo Negocio</span>
          </Link>
        </div>
      </div>

      {/* Tarjetas de Métricas (KPIs) */}
      <section aria-labelledby="kpis-title">
        <h2 id="kpis-title" className="sr-only">
          Indicadores clave de rendimiento
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.title}
                className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    {kpi.title}
                  </span>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.iconBg}`}
                  >
                    <Icon size={20} strokeWidth={2.2} />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-extrabold tracking-tight text-gray-900">
                    {kpi.value}
                  </div>
                  <p className="mt-1 text-xs font-medium text-gray-500">
                    {kpi.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sección de Actividad Reciente */}
      <section
        aria-labelledby="recent-activity-title"
        className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
      >
        <div className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100">
          <div>
            <h2
              id="recent-activity-title"
              className="text-lg font-bold text-gray-900 tracking-tight"
            >
              Últimos Comercios Creados
            </h2>
            <p className="text-xs font-medium text-gray-500 mt-0.5">
              Los 5 negocios registrados más recientemente en la plataforma.
            </p>
          </div>
          <Link
            href="/admin/negocios"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF1F2D] hover:underline"
          >
            <span>Ver todos</span>
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
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#FF1F2D] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#e01826]"
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
                    {/* Nombre y Logo */}
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

                    {/* Fecha de alta */}
                    <td className="px-6 py-4 text-xs font-medium text-gray-600">
                      <div className="inline-flex items-center gap-1.5">
                        <Calendar size={13} className="text-gray-400" />
                        <span>{formatDate(business.created_at)}</span>
                      </div>
                    </td>

                    {/* Estado */}
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

                    {/* Acciones / Enlace */}
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/negocios`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-[#FF1F2D] transition-colors"
                        title="Ver en Gestión de Negocios"
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
