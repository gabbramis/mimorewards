"use client";
import { useState, useEffect } from "react";
import { Users, Star, Award, TrendingUp, RefreshCcw, Calendar as CalendarIcon, Clock, Activity } from "lucide-react";
import { createClient } from '@/lib/supabase/client';

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

    const supabase = createClient();
    const BUSINESS_ID = "ea6ae0d6-c8db-4b15-a09d-9726f93b7119";

    const fetchMetrics = async () => {
        setIsLoading(true);
        try {
            // 1. Total Customers
            const { count: totalCustomersCount, data: allCustomers } = await supabase
                .from('customers')
                .select('current_stamps, total_visits', { count: 'exact' })
                .eq('business_id', BUSINESS_ID);

            const customersList = allCustomers || [];
            const totalCustomers = totalCustomersCount || 0;

            // 4. Ready to Redeem & 5. Retention Rate
            let readyToRedeem = 0;
            let recurrentCustomers = 0;

            customersList.forEach(c => {
                if (c.current_stamps >= 10) readyToRedeem++;
                if (c.total_visits > 1) recurrentCustomers++;
            });

            const retentionRate = totalCustomers > 0
                ? Math.round((recurrentCustomers / totalCustomers) * 100)
                : 0;

            // 2 & 3. Stamp logs handling
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

            // Recent logs (joining customers)
            const { data: logsData } = await supabase
                .from('stamp_logs')
                .select(`
          id,
          method,
          created_at,
          customers (
            first_name,
            last_name,
            unique_code
          )
        `)
                .eq('business_id', BUSINESS_ID)
                .order('created_at', { ascending: false })
                .limit(10);

            setRecentLogs(logsData || []);

            // Calculate 7 day chart data
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            const { data: weekLogs } = await supabase
                .from('stamp_logs')
                .select('created_at, method')
                .eq('business_id', BUSINESS_ID)
                .gte('created_at', sevenDaysAgo.toISOString())
                .neq('method', 'REDEEM');

            // Build 7 days array based on client local time
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
        }
    };

    useEffect(() => {
        // The metrics request is the external synchronization for this view.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchMetrics();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Chart max value for scaling CSS bars
    const maxChartValue = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 0;
    const highestBar = maxChartValue > 0 ? maxChartValue : 1; // avoid division by 0

    return (
        <div className="p-6 sm:p-10 max-w-6xl mx-auto font-sans">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Métricas del Negocio</h1>
                    <p className="text-gray-500 text-sm mt-1.5 font-medium">Analiza la actividad de retención y visitas de tus clientes en tiempo real.</p>
                </div>
                <button
                    onClick={fetchMetrics}
                    disabled={isLoading}
                    className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
                >
                    <RefreshCcw size={18} className={isLoading ? "animate-spin" : ""} />
                    Refrescar
                </button>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24">
                    <RefreshCcw size={36} className="text-indigo-500 animate-spin mb-4" />
                    <p className="text-slate-500 font-medium">Calculando métricas desde Supabase...</p>
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-sm font-semibold text-slate-500">Clientes Totales</p>
                                <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg"><Users size={16} /></div>
                            </div>
                            <h3 className="text-3xl font-black text-slate-900">{metrics.totalCustomers}</h3>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-sm font-semibold text-slate-500">Sellos Totales</p>
                                <div className="bg-purple-50 text-purple-600 p-2 rounded-lg"><Star size={16} /></div>
                            </div>
                            <h3 className="text-3xl font-black text-slate-900">{metrics.totalStamps}</h3>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-sm font-semibold text-slate-500">Visitas (30d)</p>
                                <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg"><CalendarIcon size={16} /></div>
                            </div>
                            <h3 className="text-3xl font-black text-slate-900">{metrics.monthVisits}</h3>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-sm font-semibold text-slate-500">Premios Listos</p>
                                <div className="bg-amber-50 text-amber-600 p-2 rounded-lg"><Award size={16} /></div>
                            </div>
                            <h3 className="text-3xl font-black text-slate-900">{metrics.readyToRedeem}</h3>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-sm font-semibold text-slate-500">Retención</p>
                                <div className="bg-sky-50 text-sky-600 p-2 rounded-lg"><TrendingUp size={16} /></div>
                            </div>
                            <h3 className="text-3xl font-black text-slate-900">{metrics.retentionRate}%</h3>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* 7 Days Bar Chart */}
                        <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col">
                            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Activity size={20} className="text-indigo-600" />
                                Actividad (7 días)
                            </h2>

                            <div className="flex-1 flex items-end justify-between gap-3 h-56 mt-auto border-b border-slate-200 w-full pb-2">
                                {chartData.map((d, index) => {
                                    const isZero = d.value === 0;
                                    // Math.max asigna una altura mínima el 12% a barras con data para mantener consistencia
                                    // Las barras vacías toman un 6% puramente estético de fondo gris
                                    const percentage = isZero ? 6 : Math.max((d.value / highestBar) * 100, 12);

                                    return (
                                        <div key={index} className="flex flex-col items-center flex-1 group h-full">
                                            {/* Container Flex Bottom-Alined */}
                                            <div className="w-full h-full flex flex-col justify-end items-center relative gap-1">
                                                <span className={`text-xs font-bold transition-opacity ${isZero ? 'text-slate-300' : 'text-indigo-600 group-hover:text-indigo-800'}`}>
                                                    {d.value}
                                                </span>
                                                <div
                                                    className={`w-full max-w-[36px] rounded-t-xl transition-all duration-[600ms] ease-out border-t border-x ${isZero
                                                        ? 'bg-slate-100 border-slate-100'
                                                        : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-700/50 shadow-sm'
                                                        }`}
                                                    style={{ height: `${percentage}%` }}
                                                    title={`${d.value} sellos el ${d.label}`} // Native tooltip
                                                ></div>
                                            </div>
                                            <span className="text-xs text-slate-400 font-bold mt-3 uppercase tracking-wider">{d.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Recent Activity Feed */}
                        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Clock size={20} className="text-slate-400" />
                                Flujo de Actividad Reciente
                            </h2>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                                            <th className="px-5 py-3 font-bold">CLIENTE</th>
                                            <th className="px-5 py-3 font-bold">FECHA Y HORA</th>
                                            <th className="px-5 py-3 font-bold">TRANSACCIÓN</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {recentLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="px-5 py-8 text-center text-slate-400 font-medium">
                                                    No hay actividad reciente registrada en Supabase.
                                                </td>
                                            </tr>
                                        ) : recentLogs.map((log) => {
                                            const clientName = log.customers
                                                ? `${log.customers.first_name} ${log.customers.last_name}`
                                                : "Cliente Eliminado/Oculto";

                                            const uniqueCode = log.customers?.unique_code;

                                            const isRedeem = log.method === 'REDEEM';
                                            const methodColor =
                                                log.method === 'QR' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                                    log.method === 'NFC' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                        isRedeem ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                            'bg-slate-50 text-slate-700 border-slate-200';

                                            const dateObj = new Date(log.created_at);
                                            const formattedDate = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                                            const formattedTime = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                                            return (
                                                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                                                    <td className="px-5 py-4">
                                                        <div className="font-bold text-slate-900">{clientName}</div>
                                                        {uniqueCode && <div className="text-xs text-slate-400 mt-0.5 font-mono font-medium">{uniqueCode}</div>}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="text-sm font-bold text-slate-700 capitalize">{formattedDate}</div>
                                                        <div className="text-xs text-slate-400 mt-0.5 font-medium">{formattedTime} hs</div>
                                                    </td>
                                                    <td className="px-5 py-4 relative">
                                                        <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm ${methodColor}`}>
                                                            {isRedeem ? '🏆 CANJE DE PREMIO' : `SELLO ${log.method}`}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                </>
            )}
        </div>
    );
}
