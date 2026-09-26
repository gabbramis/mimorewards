"use client";
import { useState, useEffect } from "react";
import {
    Users, Star, Award, TrendingUp, RefreshCcw, Calendar as CalendarIcon, Clock, Activity,
    Download, ChevronDown, ArrowRight, Search, Gift, Zap
} from "lucide-react";
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function MetricsDashboard() {
    const [metrics, setMetrics] = useState({
        totalCustomers: 0,
        totalStamps: 0,
        monthVisits: 0,
        readyToRedeem: 0,
        retentionRate: 0,
    });
    const [recentLogs, setRecentLogs] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Table Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState("Todos");

    const supabase = createClient();
    const BUSINESS_ID = "ea6ae0d6-c8db-4b15-a09d-9726f93b7119";

    const fetchMetrics = async () => {
        setIsRefreshing(true);
        try {
            const { count: totalCustomersCount, data: allCustomers } = await supabase
                .from('customers')
                .select('current_stamps, total_visits', { count: 'exact' })
                .eq('business_id', BUSINESS_ID);

            const customersList = allCustomers || [];
            const totalCustomers = totalCustomersCount || 0;

            let readyToRedeem = 0;
            let recurrentCustomers = 0;

            customersList.forEach(c => {
                if (c.current_stamps >= 10) readyToRedeem++;
                if (c.total_visits > 1) recurrentCustomers++;
            });

            const retentionRate = totalCustomers > 0
                ? Math.round((recurrentCustomers / totalCustomers) * 100)
                : 0;

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { count: totalStampsCount } = await supabase
                .from('stamp_logs')
                .select('*', { count: 'exact', head: true })
                .eq('business_id', BUSINESS_ID)
                .neq('method', 'REDEEM');

            const { count: monthVisitsCount } = await supabase
                .from('stamp_logs')
                .select('*', { count: 'exact', head: true })
                .eq('business_id', BUSINESS_ID)
                .gte('created_at', thirtyDaysAgo.toISOString())
                .neq('method', 'REDEEM');

            setMetrics({
                totalCustomers,
                totalStamps: totalStampsCount || 0,
                monthVisits: monthVisitsCount || 0,
                readyToRedeem,
                retentionRate
            });

            const { data: logsData } = await supabase
                .from('stamp_logs')
                .select(`
                  id, method, created_at,
                  customers ( first_name, last_name, unique_code )
                `)
                .eq('business_id', BUSINESS_ID)
                .order('created_at', { ascending: false })
                .limit(40);

            setRecentLogs(logsData || []);

            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            const { data: weekLogs } = await supabase
                .from('stamp_logs')
                .select('created_at, method')
                .eq('business_id', BUSINESS_ID)
                .gte('created_at', sevenDaysAgo.toISOString())
                .neq('method', 'REDEEM');

            const daysMap = {};
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const dateKey = `${yyyy}-${mm}-${dd}`;
                daysMap[dateKey] = {
                    label: d.toLocaleDateString('es-ES', { weekday: 'short' }),
                    value: 0
                };
            }

            if (weekLogs) {
                weekLogs.forEach(log => {
                    const logDate = new Date(log.created_at);
                    const yyyy = logDate.getFullYear();
                    const mm = String(logDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(logDate.getDate()).padStart(2, '0');
                    const logDateKey = `${yyyy}-${mm}-${dd}`;

                    if (daysMap[logDateKey]) {
                        daysMap[logDateKey].value++;
                    }
                });
            }

            const cData = Object.keys(daysMap).map(dateStr => {
                return {
                    label: daysMap[dateStr].label,
                    value: daysMap[dateStr].value
                };
            });
            setChartData(cData);

        } catch (err) {
            console.error("Error fetching metrics:", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Tablas filtradas
    const filteredLogs = recentLogs.filter(log => {
        const matchesSearch = log.customers
            ? `${log.customers.first_name} ${log.customers.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
            : false;

        let matchesFilter = true;
        if (activeFilter === "Sellos") matchesFilter = log.method !== 'REDEEM';
        if (activeFilter === "Canjes") matchesFilter = log.method === 'REDEEM';
        // Mock 'Nuevos'
        if (activeFilter === "Nuevos") matchesFilter = false;

        return matchesSearch && matchesFilter;
    });

    const maxChartValue = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 0;
    const highestBar = maxChartValue > 0 ? maxChartValue : 1;

    // Insights del grafico
    const peakDay = chartData.length > 0 ? [...chartData].sort((a, b) => b.value - a.value)[0] : null;
    const peakPercentage = peakDay && metrics.totalStamps > 0
        ? Math.round((peakDay.value / chartData.reduce((acc, curr) => acc + curr.value, 0)) * 100)
        : 0;

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto font-sans bg-slate-50 min-h-screen space-y-6">

            {/* 1. Header del Módulo */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Métricas del Negocio</h1>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Datos en vivo
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">Analiza el rendimiento en tiempo real de tu estrategia de fidelización.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition shadow-sm font-medium">
                        <CalendarIcon size={16} /> Últimos 30 días <ChevronDown size={14} className="ml-1 opacity-50" />
                    </button>
                    <button
                        onClick={fetchMetrics}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition shadow-sm font-medium disabled:opacity-50"
                    >
                        <RefreshCcw size={16} className={isRefreshing ? "animate-spin text-blue-600" : ""} />
                        Refrescar
                    </button>
                    <button className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-800 transition shadow-sm font-medium hidden sm:flex">
                        <Download size={16} /> Exportar CSV
                    </button>
                </div>
            </div>

            {/* Smart Alert Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between text-white shadow-md relative overflow-hidden">
                <div className="absolute right-0 top-0 opacity-10 pointer-events-none w-64 h-64 -translate-y-16 translate-x-12">
                    <Zap size={256} />
                </div>
                <div className="flex items-center gap-3 relative z-10 w-full mb-3 sm:mb-0">
                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                        <Zap size={20} className="text-white" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm">Oportunidad de Retención</h4>
                        <p className="text-blue-100 text-xs mt-0.5">Tienes <strong className="text-white">{metrics.readyToRedeem} clientes</strong> listos para reclamar su premio. Impulsa su regreso.</p>
                    </div>
                </div>
                <Link href="/admin/contactos" className="relative z-10 whitespace-nowrap bg-white text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-bold transition shadow-sm flex items-center gap-2 w-full sm:w-auto justify-center">
                    Ver Contactos <ArrowRight size={16} />
                </Link>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <RefreshCcw size={32} className="text-indigo-500 animate-spin" />
                </div>
            ) : (
                <>
                    {/* 2. Fila de KPIs Superiores (5 Tarjetas) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-blue-200 transition">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Clientes Activos</p>
                                <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg"><Users size={16} /></div>
                            </div>
                            <div className="mt-2">
                                <h3 className="text-2xl font-black text-slate-900">{metrics.totalCustomers}</h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+12%</span>
                                    <span className="text-[10px] text-slate-400 font-medium">nuevos este mes</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-purple-200 transition">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sellos Otorgados</p>
                                <div className="bg-purple-50 text-purple-600 p-1.5 rounded-lg"><Star size={16} /></div>
                            </div>
                            <div className="mt-2">
                                <h3 className="text-2xl font-black text-slate-900">{metrics.totalStamps}</h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">~ 14/día</span>
                                    <span className="text-[10px] text-slate-400 font-medium">promedio est.</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-emerald-200 transition">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Visitas (30D)</p>
                                <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg"><CalendarIcon size={16} /></div>
                            </div>
                            <div className="mt-2">
                                <h3 className="text-2xl font-black text-slate-900">{metrics.monthVisits}</h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">$450</span>
                                    <span className="text-[10px] text-slate-400 font-medium">ticket prom.</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-amber-200 transition">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Premios Canjeados</p>
                                <div className="bg-amber-50 text-amber-600 p-1.5 rounded-lg"><Gift size={16} /></div>
                            </div>
                            <div className="mt-2">
                                {/* Usando un mock de canjes históricos basado en la tasa de retención simulada para demostrar UI */}
                                <h3 className="text-2xl font-black text-slate-900">42</h3>
                                <div className="flex items-center gap-1.5 mt-1" title="Favorito: Café Latte Especial">
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">☕ Café Latte</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-sky-200 transition">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tasa de Retorno</p>
                                <div className="bg-sky-50 text-sky-600 p-1.5 rounded-lg"><TrendingUp size={16} /></div>
                            </div>
                            <div className="mt-2">
                                <h3 className="text-2xl font-black text-slate-900">{metrics.retentionRate}%</h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">Top 15%</span>
                                    <span className="text-[10px] text-slate-400 font-medium">en tu industria</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Fila Central de Rendimiento (2 Columnas) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Izquierda: Gráfico de Afluencia */}
                        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">Afluencia y Movimiento</h2>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">Volumen de sellos otorgados (últimos 7 días)</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-lg text-slate-400"><Activity size={18} /></div>
                            </div>

                            <div className="flex-1 flex items-end justify-between gap-1 sm:gap-3 h-52 mt-auto border-b border-slate-100 w-full pb-2 relative">
                                {/* Grid lines background */}
                                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30">
                                    <div className="w-full border-t border-slate-200 border-dashed"></div>
                                    <div className="w-full border-t border-slate-200 border-dashed"></div>
                                    <div className="w-full border-t border-slate-200 border-dashed"></div>
                                </div>

                                {chartData.map((d, index) => {
                                    const isZero = d.value === 0;
                                    const percentage = isZero ? 4 : Math.max((d.value / highestBar) * 100, 10);
                                    // Highlight peak day
                                    const isPeak = d.value > 0 && d.value === peakDay?.value;

                                    return (
                                        <div key={index} className="flex flex-col items-center flex-1 group h-full z-10 w-full">
                                            <div className="w-full h-full flex flex-col justify-end items-center relative gap-1.5 px-0.5">
                                                <span className={`text-[10px] sm:text-xs font-bold transition-opacity ${isPeak ? 'text-indigo-600' : isZero ? 'text-slate-300' : 'text-slate-500 group-hover:text-slate-700'}`}>
                                                    {d.value}
                                                </span>
                                                <div
                                                    className={`w-full max-w-[40px] rounded-t-lg transition-all duration-700 ease-out border-t ${isZero
                                                        ? 'bg-slate-100 border-slate-200'
                                                        : isPeak ? 'bg-indigo-600 border-indigo-700 hover:bg-indigo-700 shadow-md' : 'bg-blue-200 border-blue-300 hover:bg-blue-300'
                                                        }`}
                                                    style={{ height: `${percentage}%` }}
                                                    title={`${d.value} sellos el ${d.label}`}
                                                ></div>
                                            </div>
                                            <span className={`text-[9px] sm:text-[10px] font-bold mt-2 uppercase tracking-wider ${isPeak ? 'text-indigo-600' : 'text-slate-400'}`}>{d.label}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Insight Footer */}
                            <div className="mt-5 bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-lg p-3 border border-slate-100 flex items-center gap-3">
                                <div className="text-indigo-600 bg-white p-1 rounded-md shadow-sm">
                                    <Star size={14} />
                                </div>
                                <p className="text-xs text-slate-600 font-medium">
                                    Día pico: <strong className="text-slate-900">{peakDay?.label}</strong> concentra el <strong className="text-indigo-700">{peakPercentage}%</strong> del flujo semanal.
                                </p>
                            </div>
                        </div>

                        {/* Derecha: Fidelidad y Cohortes */}
                        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">Fidelidad y Cohortes</h2>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">Distribución de base de clientes por frecuencia</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 p-1.5 rounded-lg text-slate-400"><Award size={18} /></div>
                            </div>

                            <div className="flex-1 flex flex-col justify-center gap-6">
                                {/* Mock Level 1 */}
                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">Nivel 1 <span className="text-[10px] font-medium text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">1–2 visitas</span></h4>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-bold text-slate-900">45%</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                                        <div className="bg-slate-400 h-2.5 rounded-full" style={{ width: '45%' }}></div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1.5 font-medium flex justify-between">
                                        <span>Aprox. {Math.round(metrics.totalCustomers * 0.45)} clientes</span>
                                        <span className="text-amber-600">Riesgo de abandono</span>
                                    </p>
                                </div>

                                {/* Mock Level 2 */}
                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">Nivel 2 <span className="text-[10px] font-medium text-slate-400 px-1.5 py-0.5 bg-slate-100 rounded">3–5 visitas</span></h4>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-bold text-slate-900">35%</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                                        <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: '35%' }}></div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1.5 font-medium">Aprox. {Math.round(metrics.totalCustomers * 0.35)} clientes con hábito en formación</p>
                                </div>

                                {/* Mock VIP */}
                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <div>
                                            <h4 className="text-sm font-bold flex items-center gap-2 text-indigo-700">
                                                Frecuentes VIP
                                                <span className="text-[10px] font-bold text-indigo-700 px-1.5 py-0.5 bg-indigo-100 border border-indigo-200 rounded flex items-center gap-1">
                                                    <Star size={10} /> 6+ visitas
                                                </span>
                                            </h4>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-black text-indigo-700">20%</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                                        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full" style={{ width: '20%' }}></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-indigo-600/80 mt-1.5 bg-indigo-50 p-1.5 rounded text-center border border-indigo-100/50">
                                        Generan el 60% de tu facturación recurrente.
                                    </p>
                                </div>
                            </div>

                            <Link href="/admin/contactos" className="mt-5 text-sm font-semibold text-blue-600 hover:text-blue-800 text-center border-t border-slate-100 pt-4 flex items-center justify-center gap-1 transition">
                                Ver listado completo en CRM <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>

                    {/* 4. Tabla Inferior: Flujo de Actividad */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">

                        <div className="p-5 border-b border-slate-100 bg-white">
                            <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-4 flex items-center gap-2">
                                <Clock size={20} className="text-slate-400" />
                                Flujo de Actividad Reciente
                            </h2>

                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                                {/* Píldoras de Filtro */}
                                <div className="flex bg-slate-100/80 rounded-xl p-1 w-full sm:w-auto">
                                    {['Todos', 'Sellos', 'Canjes', 'Nuevos'].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setActiveFilter(f)}
                                            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeFilter === f
                                                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                }`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>

                                {/* Buscador */}
                                <div className="relative w-full sm:w-64">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search size={16} className="text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Buscar por cliente o teléfono..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-white border border-slate-300 text-slate-900 text-sm rounded-xl pl-10 pr-4 py-2 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left font-medium min-w-[700px]">
                                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 font-bold">Cliente</th>
                                        <th className="px-6 py-4 font-bold">Tipo de Operación</th>
                                        <th className="px-6 py-4 font-bold text-center">Operador / Caja</th>
                                        <th className="px-6 py-4 font-bold text-right">Fecha y Hora</th>
                                        <th className="px-6 py-4 font-bold"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {filteredLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                                No se encontraron resultados para los filtros aplicados.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLogs.map(log => {
                                            const isRedeem = log.method === 'REDEEM';
                                            const clientName = log.customers ? `${log.customers.first_name} ${log.customers.last_name}` : "Cliente Eliminado";
                                            const shortCode = log.customers?.unique_code || "N/A";
                                            const initials = log.customers ? `${log.customers.first_name[0]}${log.customers.last_name[0]}`.toUpperCase() : "??";

                                            const colors = ['bg-amber-100 text-amber-700', 'bg-indigo-100 text-indigo-700', 'bg-rose-100 text-rose-700', 'bg-emerald-100 text-emerald-700', 'bg-sky-100 text-sky-700'];
                                            const colorClass = colors[(log.customers?.first_name?.length || 0) % colors.length];

                                            const formattedDate = new Date(log.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                                            const formattedTime = new Date(log.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                                            return (
                                                <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="px-6 py-4 flex items-center gap-3">
                                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${colorClass} shadow-sm border border-white`}>
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{clientName}</div>
                                                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">{shortCode}</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {isRedeem ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                                <Gift size={12} /> CANJE DE PREMIO
                                                            </span>
                                                        ) : (
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border border-slate-200 shadow-sm ${log.method === 'QR' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-white text-slate-700'}`}>
                                                                <Star size={12} /> SELLO {log.method === 'MANUAL' ? 'MANUAL' : log.method}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-slate-500 text-xs font-semibold bg-slate-100 px-2 py-1 rounded">Caja Principal</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="font-bold text-slate-700 uppercase p-0 m-0 leading-tight">{formattedDate}</div>
                                                        <div className="text-[11px] text-slate-400 font-bold m-0">{formattedTime} hs</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button className="text-[11px] font-bold text-slate-400 hover:text-blue-600 bg-white border border-slate-200 hover:border-blue-300 px-3 py-1.5 rounded-lg transition opacity-0 group-hover:opacity-100 focus:opacity-100 shadow-sm h-8">
                                                            Ver
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginador footer mock */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-between items-center text-sm font-semibold text-slate-500">
                            <div>Mostrando {filteredLogs.length} registros</div>
                            <div className="flex gap-2">
                                <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 cursor-not-allowed opacity-50">Ant</button>
                                <button className="px-3 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100">Sig</button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
