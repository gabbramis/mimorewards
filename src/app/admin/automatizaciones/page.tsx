"use client";
import React, { useState, useEffect, useRef } from "react";
import {
    Cake, Clock, Award, Check, RefreshCw, CheckCircle2, AlertCircle, Plus, Trash2, Edit2, X,
    Smartphone, MessageSquare, Gift, Target, UserPlus, Play, CheckCheck, Eye, Search, Zap, Send, RotateCcw
} from "lucide-react";
import { createClient } from '@/lib/supabase/client';

export default function AutomatizacionesPage() {
    const [rules, setRules] = useState([]);
    const [logs, setLogs] = useState([]);
    const [metrics, setMetrics] = useState({
        activeRulesCount: 0,
        thisMonthLogsStr: "0",
        returnRateStr: "0%",
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [feedback, setFeedback] = useState(null);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState(getInitialModalData());
    const textareaRef = useRef(null);

    // Tabla Historial States
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("Todos");

    const supabase = createClient();
    const BUSINESS_ID = "ea6ae0d6-c8db-4b15-a09d-9726f93b7119";

    function getInitialModalData() {
        return {
            id: null, title: "", rule_type: "BIRTHDAY", channel: "WHATSAPP", message_template: ""
        };
    }

    const fetchConfig = async () => {
        setIsLoading(true);
        try {
            // Reglas
            let { data: dbRules } = await supabase
                .from('automation_rules')
                .select('*')
                .eq('business_id', BUSINESS_ID)
                .order('created_at', { ascending: false });

            if (!dbRules || dbRules.length === 0) {
                const initialRules = [
                    { business_id: BUSINESS_ID, rule_type: 'BIRTHDAY', is_active: false, message_template: '¡Feliz cumple {nombre}! 🎂 Te esperamos con un regalo para festejar.' },
                    { business_id: BUSINESS_ID, rule_type: 'INACTIVE', is_active: false, message_template: '¡Hola {nombre}! Hace unos días no te vemos ☕ Te dejamos un beneficio.' },
                ];
                await supabase.from('automation_rules').insert(initialRules);
                const { data: newlyInserted } = await supabase.from('automation_rules').select('*').eq('business_id', BUSINESS_ID).order('created_at', { ascending: false });
                dbRules = newlyInserted || [];
            }

            const parsedRules = (dbRules || []).map(r => ({
                ...r,
                title: r.title || getRuleDefaults(r.rule_type).title,
                channel: r.channel || 'WHATSAPP'
            }));
            setRules(parsedRules);

            // Log Histórico
            const { data: dbLogs } = await supabase
                .from('automation_logs')
                .select(`
                    id, status, sent_at,
                    customers ( customer_id:id, first_name, last_name, phone ),
                    automation_rules ( rule_type, title )
                `)
                .eq('business_id', BUSINESS_ID)
                .order('sent_at', { ascending: false })
                .limit(40);

            setLogs(dbLogs || []);

            // Métricas Reales

            // 1. Activas
            const countActives = parsedRules.filter(r => r.is_active).length;

            // 2. Envíos Mes Actual
            const beginningOfMonth = new Date();
            beginningOfMonth.setDate(1);
            beginningOfMonth.setHours(0, 0, 0, 0);

            const { count: thisMonthLogsCount } = await supabase
                .from('automation_logs')
                .select('*', { count: 'exact', head: true })
                .eq('business_id', BUSINESS_ID)
                .gte('sent_at', beginningOfMonth.toISOString());

            // 3. Tasa de Retorno (Clientes que volvieron a canjear/sellar luego del msj)
            const { data: allLogs } = await supabase
                .from('automation_logs')
                .select('customer_id, sent_at')
                .eq('business_id', BUSINESS_ID);

            const { data: allStamps } = await supabase
                .from('stamp_logs')
                .select('customer_id, created_at')
                .eq('business_id', BUSINESS_ID);

            let returnedCount = 0;
            let totalUniqueAlerted = 0;

            if (allLogs && allLogs.length > 0) {
                const earliestLog = {};
                allLogs.forEach(log => {
                    const current = earliestLog[log.customer_id];
                    if (!current || new Date(log.sent_at) < current) {
                        earliestLog[log.customer_id] = new Date(log.sent_at);
                    }
                });

                totalUniqueAlerted = Object.keys(earliestLog).length;

                if (allStamps && allStamps.length > 0) {
                    Object.keys(earliestLog).forEach(custId => {
                        const firstLogDate = earliestLog[custId];
                        const hasStampsAfter = allStamps.some(s => s.customer_id === custId && new Date(s.created_at) > firstLogDate);
                        if (hasStampsAfter) returnedCount++;
                    });
                }
            }

            const calculatedReturnRate = totalUniqueAlerted > 0 ? Math.round((returnedCount / totalUniqueAlerted) * 100) : 0;

            setMetrics({
                activeRulesCount: countActives,
                thisMonthLogsStr: (thisMonthLogsCount || 0).toString(),
                returnRateStr: `${calculatedReturnRate}%`
            });

        } catch (error) {
            console.error("Error fetching config:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const showFeedback = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback(null), 3000);
    };

    const handleRunEngine = async () => {
        setIsRunning(true);
        try {
            const res = await fetch('/api/automations/run', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showFeedback('success', data.message || 'Ejecución finalizada.');
                fetchConfig();
            } else {
                showFeedback('error', 'Error en la ejecución: ' + data.error);
            }
        } catch (error) {
            showFeedback('error', 'Error al contactar motor.');
        } finally {
            setIsRunning(false);
        }
    };

    const handleToggle = async (id, currentStatus) => {
        const newStatus = !currentStatus;
        setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: newStatus } : r));
        try {
            await supabase.from('automation_rules').update({ is_active: newStatus }).eq('id', id);
            fetchConfig(); // actualizar metricas
        } catch (e) {
            setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: currentStatus } : r));
            showFeedback('error', 'No se pudo actualizar el estado.');
        }
    };

    const handleDeleteRule = async (id) => {
        if (!window.confirm("¿Seguro que deseas eliminar esta regla?")) return;
        setRules(prev => prev.filter(r => r.id !== id));
        try {
            await supabase.from('automation_rules').delete().eq('id', id);
            showFeedback('success', 'Regla eliminada.');
            fetchConfig(); // refresh kpis
        } catch (e) {
            fetchConfig();
            showFeedback('error', 'Error al eliminar.');
        }
    };

    const handleTestWhatsApp = (template) => {
        const sampleText = template
            .replace(/{nombre}/g, 'Franco')
            .replace(/{negocio}/g, 'El Gran Café')
            .replace(/{sellos_faltantes}/g, '2');
        window.open(`https://wa.me/?text=${encodeURIComponent(sampleText)}`, '_blank');
    };

    const openModal = (rule = null) => {
        if (rule) {
            setModalData({
                ...rule,
                title: rule.title || getRuleDefaults(rule.rule_type).title,
                channel: rule.channel || 'WHATSAPP'
            });
        } else {
            setModalData(getInitialModalData());
        }
        setIsModalOpen(true);
    };

    const insertTag = (tag) => {
        if (textareaRef.current) {
            const start = textareaRef.current.selectionStart;
            const end = textareaRef.current.selectionEnd;
            const text = modalData.message_template;
            setModalData(prev => ({ ...prev, message_template: text.substring(0, start) + tag + text.substring(end) }));
            setTimeout(() => {
                textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + tag.length;
                textareaRef.current.focus();
            }, 0);
        } else {
            setModalData(prev => ({ ...prev, message_template: prev.message_template + tag }));
        }
    };

    const handleSaveModal = async () => {
        if (!modalData.title.trim() || !modalData.message_template.trim()) {
            alert('Título y mensaje son obligatorios.');
            return;
        }
        try {
            const payload = {
                title: modalData.title, rule_type: modalData.rule_type,
                channel: modalData.channel, message_template: modalData.message_template,
                business_id: BUSINESS_ID, is_active: false,
            };
            if (modalData.id) {
                const { error } = await supabase.from('automation_rules').update(payload).eq('id', modalData.id);
                if (error) throw error;
                showFeedback('success', 'Automatización actualizada.');
            } else {
                const { error } = await supabase.from('automation_rules').insert([payload]);
                if (error) throw error;
                showFeedback('success', 'Automatización creada.');
            }
            fetchConfig(); // refrescar
            setIsModalOpen(false);
        } catch (e) {
            showFeedback('error', 'Ocurrió un error al guardar.');
        }
    };

    function getRuleDefaults(type) {
        switch (type) {
            case 'BIRTHDAY': return { title: "Promo de Cumpleaños", icon: Cake, desc: "Fecha de nacimiento", timing: "09:00 hs el mismo día" };
            case 'INACTIVE': return { title: "Recuperación Inactivos", icon: Clock, desc: "Sin sellos recientes", timing: "30 días inactividad" };
            case 'WELCOME': return { title: "Bienvenida al Club", icon: UserPlus, desc: "1er sello sumado", timing: "15 min luego del sello" };
            case 'NEAR_REWARD': return { title: "A un paso del Premio", icon: Target, desc: "Cerca de la meta", timing: "Inmediato" };
            case 'REWARD': return { title: "Premio Disponible", icon: Gift, desc: "Tarjeta completa", timing: "Inmediato" };
            default: return { title: "Regla Custom", icon: CheckCircle2, desc: "Envío dinámico", timing: "Personalizado" };
        }
    }

    const filteredLogs = logs.filter(log => {
        const cName = log.customers ? `${log.customers.first_name} ${log.customers.last_name}`.toLowerCase() : "";
        const cPhone = log.customers?.phone?.toLowerCase() || "";
        const matchesSearch = cName.includes(searchQuery.toLowerCase()) || cPhone.includes(searchQuery.toLowerCase());

        // Mock status filters logic mapping
        let matchesStatus = true;
        // As request: 'Todos', 'Leído', 'Entregado', 'Respondido'
        if (statusFilter === "Entregado") matchesStatus = log.status === 'SENT';
        if (statusFilter === "Leído" || statusFilter === "Respondido") matchesStatus = false;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans pb-20">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* CABECERA */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Automatizaciones de Mensajería</h1>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100/60 text-green-700 border border-green-200 shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Motor Activo - WhatsApp Cloud API
                            </span>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">Incrementa tu fidelidad automatizando mensajes personalizados.</p>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={handleRunEngine}
                            disabled={isRunning || isLoading}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
                        >
                            {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 text-slate-500" />}
                            Simular Disparo / Test
                        </button>
                        {/* BOTÓN ROJO CORAL MIMO IDENTITY */}
                        <button
                            onClick={() => openModal()}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-500 border border-red-500 rounded-xl shadow-sm hover:bg-red-600 transition"
                        >
                            <Plus className="w-4 h-4" />
                            Nueva Regla
                        </button>
                    </div>
                </div>

                {feedback && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 font-medium shadow-xs border animate-in fade-in slide-in-from-top-2 ${feedback.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5" />}
                        {feedback.text}
                    </div>
                )}

                {/* KPIs EXACTAMENTE 4 CARDS REALES Y LIMPIAS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Tarjeta 1 - Activas */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between items-start group">
                        <div className="bg-slate-50 p-2 rounded-lg text-slate-500 mb-3 group-hover:bg-red-50 group-hover:text-red-500 transition-colors">
                            <Zap size={18} />
                        </div>
                        <div>
                            <p className="text-3xl font-black text-slate-900">{isLoading ? '-' : metrics.activeRulesCount}</p>
                            <h3 className="text-sm font-bold text-slate-500 mt-0.5">Automatizaciones Activas</h3>
                            <span className="text-xs font-semibold text-slate-400">{metrics.activeRulesCount} de {rules.length} configuradas</span>
                        </div>
                    </div>

                    {/* Tarjeta 2 - Envíos */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between items-start group">
                        <div className="bg-slate-50 p-2 rounded-lg text-slate-500 mb-3 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                            <Send size={18} />
                        </div>
                        <div>
                            <p className="text-3xl font-black text-slate-900">{isLoading ? '-' : metrics.thisMonthLogsStr}</p>
                            <h3 className="text-sm font-bold text-slate-500 mt-0.5">Mensajes Enviados</h3>
                            <span className="text-xs font-semibold text-slate-400">Envíos acumulados este mes</span>
                        </div>
                    </div>

                    {/* Tarjeta 3 - Retorno */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between items-start group">
                        <div className="bg-slate-50 p-2 rounded-lg text-slate-500 mb-3 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                            <RotateCcw size={18} />
                        </div>
                        <div>
                            <p className="text-3xl font-black text-slate-900">{isLoading ? '-' : metrics.returnRateStr}</p>
                            <h3 className="text-sm font-bold text-slate-500 mt-0.5">Tasa de Retorno</h3>
                            <span className="text-xs font-semibold text-slate-400">Clientes reactivados tras mensaje</span>
                        </div>
                    </div>

                    {/* Tarjeta 4 - Empty Placeholder */}
                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center opacity-70">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                            <AlertCircle size={14} className="text-slate-400" />
                        </div>
                        <p className="text-sm font-semibold text-slate-400">Próxima métrica</p>
                        <span className="text-xs text-slate-400 mt-1">en desarrollo</span>
                    </div>
                </div>

                {/* LISTADO DE REGLAS (Tarjetas Horizontales Limpias) */}
                <h2 className="text-xl font-bold text-slate-900 tracking-tight pt-2">Flujos y Campañas Activas</h2>

                {isLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <RefreshCw className="animate-spin text-slate-300 w-10 h-10" />
                    </div>
                ) : rules.length === 0 ? (
                    <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-400 mb-4"><MessageSquare className="w-8 h-8" /></div>
                        <h3 className="font-bold text-slate-800 text-xl tracking-tight">Crea tu primera automatización</h3>
                        <p className="text-slate-500 mt-2 max-w-sm">Aún no hay mensajes. Configura reglas de envío automático para retener a tus clientes.</p>
                        <button onClick={() => openModal()} className="mt-6 px-6 py-3 text-sm font-bold text-white bg-red-500 rounded-xl shadow-xs hover:bg-red-600 transition flex items-center gap-2">
                            <Plus className="w-5 h-5" /> Nueva Regla
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {rules.map(rule => {
                            const meta = getRuleDefaults(rule.rule_type);
                            const Icon = meta.icon;

                            return (
                                <div key={rule.id} className={`bg-white border rounded-2xl p-0 shadow-xs overflow-hidden flex flex-col md:flex-row transition-all hover:shadow-sm ${rule.is_active ? 'border-slate-100' : 'border-slate-100 opacity-80'}`}>
                                    {/* Izquierda: Info */}
                                    <div className="p-5 sm:p-6 flex-1 flex items-start gap-4 border-b md:border-b-0 md:border-r border-slate-100">
                                        <div className={`w-12 h-12 rounded-xl flex shrink-0 items-center justify-center text-xl font-bold ${rule.is_active ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-400'}`}>
                                            <Icon className="w-6 h-6" />
                                        </div>
                                        <div className="w-full">
                                            <div className="flex justify-between items-start w-full">
                                                <div>
                                                    <h3 className="font-bold text-lg text-slate-900 leading-tight">{rule.title}</h3>
                                                    <div className="flex items-center gap-3 flex-wrap mt-1">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                                                            {meta.timing}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Coral Toggle */}
                                                <button
                                                    onClick={() => handleToggle(rule.id, rule.is_active)}
                                                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full focus:outline-none transition-colors duration-200 mt-1 ${rule.is_active ? 'bg-red-500' : 'bg-slate-200'}`}
                                                >
                                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${rule.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                </button>
                                            </div>

                                            <div className="mt-4 bg-slate-50 rounded-xl p-3 text-sm text-slate-600 font-medium italic relative">
                                                <div className="absolute top-0 left-4 w-3 h-3 bg-slate-50 border-t border-l border-slate-50 -translate-y-1.5 rotate-45"></div>
                                                &quot;{rule.message_template.length > 80 ? rule.message_template.substring(0, 80) + '...' : rule.message_template}&quot;
                                            </div>
                                        </div>
                                    </div>

                                    {/* Derecha: Acciones Limpias */}
                                    <div className="p-4 sm:p-6 flex flex-row md:flex-col justify-end md:items-end gap-3 md:w-28 bg-slate-50/30">
                                        <button onClick={() => openModal(rule)} className="flex flex-1 md:flex-none justify-center items-center gap-2 p-2 text-sm font-semibold text-slate-500 hover:text-red-500 bg-white hover:bg-red-50 rounded-lg border border-slate-200 transition-colors shadow-xs" title="Editar">
                                            <Edit2 size={16} /> <span className="md:hidden">Editar</span>
                                        </button>
                                        <button onClick={() => handleTestWhatsApp(rule.message_template)} className="flex flex-1 md:flex-none justify-center items-center gap-2 p-2 text-sm font-semibold text-slate-500 hover:text-blue-500 bg-white hover:bg-blue-50 rounded-lg border border-slate-200 transition-colors shadow-xs" title="Vista Previa">
                                            <Eye size={16} /> <span className="md:hidden">Probar</span>
                                        </button>
                                        <button onClick={() => handleDeleteRule(rule.id)} className="flex flex-1 md:flex-none justify-center items-center gap-2 p-2 text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 rounded-lg border border-slate-200 transition-colors shadow-xs" title="Borrar">
                                            <Trash2 size={16} /> <span className="md:hidden">Borrar</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* HISTORIAL OPERATIVO (Auditoría) */}
                <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden mt-10">
                    <div className="p-5 border-b border-slate-100">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
                            Auditoría de Envíos Realizados
                        </h2>

                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                            <div className="relative w-full sm:w-80">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search size={16} className="text-slate-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar por cliente o teléfono..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium rounded-xl pl-10 pr-4 py-2 focus:ring-1 focus:ring-red-500 focus:bg-white outline-none transition"
                                />
                            </div>

                            <div className="flex bg-slate-50 p-1 rounded-xl w-full sm:w-auto overflow-x-auto hide-scrollbar">
                                {['Todos', 'Entregado'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setStatusFilter(f)}
                                        className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${statusFilter === f
                                            ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-leftbg-white text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100 font-bold text-[11px] text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Cliente</th>
                                    <th className="px-6 py-4">Regla</th>
                                    <th className="px-6 py-4 text-center">Fecha y Hora</th>
                                    <th className="px-6 py-4 text-center">WhatsApp Status</th>
                                    <th className="px-6 py-4 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                            <RefreshCw className="animate-spin text-slate-300 mx-auto w-6 h-6 mb-3" />
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-10 text-center text-slate-500 font-medium">
                                            No se encontraron envíos que coincidan.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log) => {
                                        const c = log.customers;
                                        const r = log.automation_rules;
                                        const clientName = c ? `${c.first_name} ${c.last_name}` : 'Desconocido';
                                        const phone = c?.phone || 'Sin número';
                                        const initials = c ? `${c.first_name[0]}${c.last_name[0]}`.toUpperCase() : '??';
                                        const ruleTitle = r?.title || getRuleDefaults(r?.rule_type).title || 'Automatización';

                                        const dateObj = new Date(log.sent_at);
                                        const fDate = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                                        const fTime = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                                        return (
                                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-red-50 text-red-500 flex items-center justify-center font-bold text-xs shrink-0">
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900">{clientName}</div>
                                                            <div className="text-[11px] text-slate-400 font-medium font-mono">{phone}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="font-bold text-slate-700">{ruleTitle}</div>
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <div className="font-bold text-slate-900">{fDate}</div>
                                                    <div className="text-[11px] text-slate-400 font-bold">{fTime} hs</div>
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-bold bg-green-50 text-green-700 border border-green-100">
                                                        <CheckCheck size={14} className="text-[#34B7F1]" />
                                                        {log.status === 'SENT' ? 'ENTREGADO' : log.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <button className="text-xs font-bold text-slate-400 hover:text-red-500 bg-white border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition shadow-xs opacity-0 group-hover:opacity-100">
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
                </div>
            </div>

            {/* MODAL CONFIG */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="p-6 md:p-8 flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">{modalData.id ? 'Editar Automatización' : 'Nueva Automatización'}</h2>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full p-2.5 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">Nombre Interno</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Promo Cumpleañeros"
                                        value={modalData.title}
                                        onChange={(e) => setModalData({ ...modalData, title: e.target.value })}
                                        className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none w-full"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">Disparador (Evento)</label>
                                    <select
                                        value={modalData.rule_type}
                                        onChange={(e) => setModalData({ ...modalData, rule_type: e.target.value })}
                                        className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none w-full appearance-none"
                                    >
                                        <option value="WELCOME">Nuevo Cliente</option>
                                        <option value="BIRTHDAY">Cumpleaños</option>
                                        <option value="INACTIVE">Inactividad (30 días)</option>
                                        <option value="NEAR_REWARD">Cerca de Premio</option>
                                        <option value="REWARD">Premio Disponible</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">Mensaje (WhatsApp)</label>
                                    <div className="border border-slate-300 rounded-xl bg-slate-50 focus-within:bg-white focus-within:border-red-500 transition">
                                        <div className="bg-slate-100/50 border-b border-slate-200 px-3 py-2 flex flex-wrap gap-2">
                                            <button onClick={() => insertTag('{nombre}')} className="bg-white border border-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded shadow-xs hover:text-red-500 transition">+ {'{nombre}'}</button>
                                            <button onClick={() => insertTag('{negocio}')} className="bg-white border border-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded shadow-xs hover:text-red-500 transition">+ {'{negocio}'}</button>
                                        </div>
                                        <textarea
                                            ref={textareaRef}
                                            placeholder="Escribe el cuerpo del mensaje..."
                                            className="w-full bg-transparent p-4 text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none resize-none min-h-[120px]"
                                            value={modalData.message_template}
                                            onChange={(e) => setModalData({ ...modalData, message_template: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mt-8">
                                <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition w-full sm:w-auto">
                                    Cancelar
                                </button>
                                <button onClick={handleSaveModal} className="flex-1 px-5 py-2.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 transition shadow-sm border border-red-500">
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
