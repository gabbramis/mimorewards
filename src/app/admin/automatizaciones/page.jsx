"use client";
import React, { useState, useEffect, useRef } from "react";
import {
    Cake,
    Clock,
    Award,
    Check,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Plus,
    Trash2,
    Edit2,
    X,
    Smartphone, // Para app/sms
    MessageSquare,
    Gift,
    Target,
    UserPlus
} from "lucide-react";
import { createClient } from '@/lib/supabase/client';

export default function AutomatizacionesPage() {
    const [rules, setRules] = useState([]);
    const [logs, setLogs] = useState([]);
    const [metrics, setMetrics] = useState({ totalLogs: 0, impactedCustomers: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [feedback, setFeedback] = useState(null);

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState(getInitialModalData());
    const textareaRef = useRef(null);

    const supabase = createClient();
    const BUSINESS_ID = "ea6ae0d6-c8db-4b15-a09d-9726f93b7119"; // ID de pruebas

    function getInitialModalData() {
        return {
            id: null,
            title: "",
            rule_type: "BIRTHDAY",
            channel: "WHATSAPP", // 'WHATSAPP' o 'SMS'
            message_template: ""
        };
    }

    const fetchConfig = async () => {
        setIsLoading(true);
        try {
            // Fetch Reglas
            let { data: dbRules } = await supabase
                .from('automation_rules')
                .select('*')
                .eq('business_id', BUSINESS_ID)
                .order('created_at', { ascending: false });

            // Seed inicial si está vacío
            if (!dbRules || dbRules.length === 0) {
                const initialRules = [
                    { business_id: BUSINESS_ID, rule_type: 'BIRTHDAY', is_active: false, message_template: '¡Feliz cumple {nombre}! 🎂 Te esperamos en El Gran Café con una consumición de regalo para festejar tu día. Mostrá este mensaje en caja.' },
                    { business_id: BUSINESS_ID, rule_type: 'INACTIVE', is_active: false, message_template: '¡Hola {nombre}! Hace unos días no te vemos por El Gran Café ☕ Te dejamos un beneficio especial en tu próxima visita para que vuelvas a sumar sellos.' },
                    { business_id: BUSINESS_ID, rule_type: 'WELCOME', is_active: false, message_template: '¡Bienvenido al Club de El Gran Café! ☕ Ya tenés tus primeros sellos acreditados. Mencioná tu celular al barista para seguir sumando.' }
                ];
                await supabase.from('automation_rules').insert(initialRules);
                const { data: newlyInserted } = await supabase.from('automation_rules').select('*').eq('business_id', BUSINESS_ID).order('created_at', { ascending: false });
                dbRules = newlyInserted || [];
            }
            // Add fallback title/channel if missing for old data mappings
            const parsedRules = (dbRules || []).map(r => ({
                ...r,
                title: r.title || getRuleDefaults(r.rule_type).title,
                channel: r.channel || 'WHATSAPP'
            }));

            setRules(parsedRules);

            // Fetch Logs
            const { data: dbLogs } = await supabase
                .from('automation_logs')
                .select(`
                    id,
                    status,
                    sent_at,
                    rule_id,
                    customers ( customer_id:id, first_name, last_name, phone ),
                    automation_rules ( rule_type, title )
                `)
                .eq('business_id', BUSINESS_ID)
                .order('sent_at', { ascending: false })
                .limit(20);

            setLogs(dbLogs || []);

            // Metrics
            const { count: totalLogsCount } = await supabase
                .from('automation_logs')
                .select('*', { count: 'exact', head: true })
                .eq('business_id', BUSINESS_ID);

            const { data: allLogs } = await supabase
                .from('automation_logs')
                .select('customer_id')
                .eq('business_id', BUSINESS_ID);

            const uniqueCustomers = new Set(allLogs?.map(l => l.customer_id) || []).size;

            setMetrics({
                totalLogs: totalLogsCount || 0,
                impactedCustomers: uniqueCustomers
            });

        } catch (error) {
            console.error("Error fetching config:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const showFeedback = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback(null), 3000);
    };

    // --- ACCIONES DE REGLAS ---
    const handleRunEngine = async () => {
        setIsRunning(true);
        try {
            const res = await fetch('/api/automations/run', { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                showFeedback('success', data.message || 'Ejecución finalizada.');
                fetchConfig(); // refrescar historial
            } else {
                showFeedback('error', 'Error en la ejecución: ' + data.error);
            }
        } catch (error) {
            showFeedback('error', 'Ocurrió un error al contactar al motor de automatización.');
        } finally {
            setIsRunning(false);
        }
    };

    const handleToggle = async (id, currentStatus) => {
        const newStatus = !currentStatus;
        setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: newStatus } : r));
        try {
            await supabase.from('automation_rules').update({ is_active: newStatus }).eq('id', id);
        } catch (e) {
            setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: currentStatus } : r));
            showFeedback('error', 'No se pudo actualizar el estado de la regla.');
        }
    };

    const handleDeleteRule = async (id) => {
        if (!window.confirm("¿Seguro que deseas eliminar esta automatización?")) return;
        setRules(prev => prev.filter(r => r.id !== id));
        try {
            await supabase.from('automation_rules').delete().eq('id', id);
            showFeedback('success', 'Automatización eliminada correctamente.');
        } catch (e) {
            fetchConfig(); // rollback UI
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

    // --- MODAL Y EDITOR ---
    const openModal = (rule = null) => {
        if (rule) {
            setModalData({
                id: rule.id,
                title: rule.title || getRuleDefaults(rule.rule_type).title,
                rule_type: rule.rule_type,
                channel: rule.channel || 'WHATSAPP',
                message_template: rule.message_template
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
            const currentText = modalData.message_template;
            const newText = currentText.substring(0, start) + tag + currentText.substring(end);
            setModalData(prev => ({ ...prev, message_template: newText }));
            // Reposition cursor
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
            alert('El título y el mensaje son obligatorios.');
            return;
        }

        try {
            const payload = {
                // Si la BD aún no tiene estas columnas, esto causará un error en Supabase
                title: modalData.title,
                rule_type: modalData.rule_type,
                channel: modalData.channel,
                message_template: modalData.message_template,
                business_id: BUSINESS_ID,
            };

            if (modalData.id) {
                // UPDATE
                const { error } = await supabase.from('automation_rules').update(payload).eq('id', modalData.id);
                if (error) throw error;

                setRules(prev => prev.map(r => r.id === modalData.id ? { ...r, ...payload } : r));
                showFeedback('success', 'Automatización actualizada.');
            } else {
                // CREATE
                payload.is_active = false; // default desactivado
                const { data: newRow, error } = await supabase.from('automation_rules').insert([payload]).select().single();
                if (error) throw error;

                if (newRow) {
                    setRules([newRow, ...rules]);
                }
                showFeedback('success', 'Automatización creada exitosamente.');
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error("Error saving rule:", e);
            showFeedback('error', e.message || 'Ocurrió un error al guardar en la BD.');
        }
    };

    // Helpers UI
    function getRuleDefaults(type) {
        switch (type) {
            case 'BIRTHDAY': return { title: "Promo de Cumpleaños", icon: Cake, desc: "Dispara en su fecha de nacimiento" };
            case 'INACTIVE': return { title: "Recuperación Inactivos", icon: Clock, desc: "Sin sellos en el último mes" };
            case 'WELCOME': return { title: "Bienvenida al Club", icon: UserPlus, desc: "Inmediato al registrarse" };
            case 'NEAR_REWARD': return { title: "A un paso del Premio", icon: Target, desc: "Empuje al llegar a 8 o 9 sellos" };
            case 'REWARD': return { title: "Premio Disponible", icon: Gift, desc: "Alcanzó el tope (10 sellos)" };
            default: return { title: "Automatización", icon: CheckCircle2, desc: "Envío dinámico" };
        }
    }

    const segmentOptions = [
        { value: 'BIRTHDAY', label: '🎂 Cumpleaños del cliente' },
        { value: 'INACTIVE', label: '💤 Cliente Inactivo (+30 días)' },
        { value: 'WELCOME', label: '✨ Nuevo Cliente (Bienvenida)' },
        { value: 'NEAR_REWARD', label: '🎯 Cerca del Premio (8 o 9 sellos)' },
        { value: 'REWARD', label: '🎁 Tarjeta Completa (10 sellos)' }
    ];

    const activeRulesCount = rules.filter(r => r.is_active).length;

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans pb-20">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* 1. CABECERA Y ACCIONES SUPERIORES */}
                <div className="space-y-4">
                    <div className="flex items-center text-sm text-slate-500 font-medium">
                        <span>Mimo</span>
                        <span className="mx-2">›</span>
                        <span>Campañas</span>
                        <span className="mx-2">›</span>
                        <span className="text-slate-900">Automatizaciones</span>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-3">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                                MÓDULO DE RETENCIÓN • Motor Activo
                            </span>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                                Automatizaciones
                            </h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={handleRunEngine}
                                disabled={isRunning || isLoading}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isRunning ? <RefreshCw className="w-4 h-4 animate-spin text-slate-400" /> : <RefreshCw className="w-4 h-4 text-slate-500" />}
                                Probar Ejecución
                            </button>
                            <button
                                onClick={() => openModal()}
                                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg shadow hover:bg-slate-800 transition-colors flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Nueva Automatización
                            </button>
                        </div>
                    </div>
                </div>

                {/* Feedback flotante superior */}
                {feedback && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 font-medium shadow-sm border ${feedback.type === 'success' ? 'bg-[#DCF8C6]/50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5" />}
                        {feedback.text}
                    </div>
                )}

                {/* 2. RESUMEN DE KPIS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                        <h3 className="text-sm font-medium text-slate-500 mb-1">Automatizaciones Activas</h3>
                        <div className="flex items-baseline gap-2">
                            <p className="text-3xl font-bold text-slate-900">{isLoading ? '-' : activeRulesCount}</p>
                            <span className="text-sm font-medium text-slate-400">/ {rules.length} total</span>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                        <h3 className="text-sm font-medium text-slate-500 mb-1">Mensajes Enviados</h3>
                        <p className="text-3xl font-bold text-slate-900">{isLoading ? '-' : metrics.totalLogs}</p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                        <h3 className="text-sm font-medium text-slate-500 mb-1">Clientes Impactados</h3>
                        <p className="text-3xl font-bold text-slate-900">{isLoading ? '-' : metrics.impactedCustomers}</p>
                    </div>
                </div>

                {/* 3. GRILLA DE REGLAS INTERACTIVA */}
                {isLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <RefreshCw className="animate-spin text-slate-300 w-10 h-10" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {rules.map(rule => {
                            const meta = getRuleDefaults(rule.rule_type);
                            const Icon = meta.icon;
                            const isWhatsApp = rule.channel === 'WHATSAPP';

                            return (
                                <div key={rule.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col h-full group hover:border-slate-300 transition-colors">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-full flex flex-shrink-0 items-center justify-center ${isWhatsApp ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 leading-tight">
                                                    {rule.title}
                                                    <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${isWhatsApp ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                                                        {rule.channel}
                                                    </span>
                                                </h3>
                                                <p className="text-xs text-slate-500 mt-1 font-medium bg-slate-50 inline-block px-1.5 py-0.5 rounded border border-slate-100">
                                                    Disparador: {meta.desc}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleToggle(rule.id, rule.is_active)}
                                            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full focus:outline-none border-2 border-transparent transition-colors ${rule.is_active ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                        >
                                            <span className={`${rule.is_active ? 'translate-x-5' : 'translate-x-0'} inline-block h-5 w-5 transform rounded-full bg-white transition shadow-sm`} />
                                        </button>
                                    </div>

                                    <div className={`mt-2 ${isWhatsApp ? 'bg-[#DCF8C6]' : 'bg-slate-100'} shadow-sm rounded-xl p-4 mb-5 relative text-sm text-slate-800 self-start w-[90%] transition-colors border ${isWhatsApp ? 'border-[#DCF8C6]' : 'border-slate-200'}`}>
                                        <div className={`absolute top-0 left-[-6px] w-0 h-0 border-t-[8px] ${isWhatsApp ? 'border-t-[#DCF8C6]' : 'border-t-slate-100'} border-l-[8px] border-l-transparent transition-colors`}></div>
                                        {rule.message_template}
                                        <div className="text-[10px] text-slate-500 text-right mt-1 flex justify-end items-center gap-1">
                                            <Check className={`w-3 h-3 ${isWhatsApp ? 'text-blue-500' : 'text-slate-400'}`} />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => openModal(rule)}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" /> Editar
                                            </button>
                                            {isWhatsApp && (
                                                <button
                                                    onClick={() => handleTestWhatsApp(rule.message_template)}
                                                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                                                >
                                                    Probar Envío
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleDeleteRule(rule.id)}
                                            className="text-slate-400 hover:text-red-500 bg-white hover:bg-red-50 border border-transparent hover:border-red-100 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="Eliminar Automatización"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Empty/Add card state if no rules exist */}
                        {!isLoading && rules.length === 0 && (
                            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center col-span-full">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-3">
                                    <MessageSquare className="w-6 h-6" />
                                </div>
                                <h3 className="font-bold text-slate-700 text-lg">Sin Automatizaciones</h3>
                                <p className="text-slate-500 text-sm mt-1 max-w-sm">No hay mensajes configurados aún. Empieza creando tu primera regla de retención para interactuar con tus clientes en piloto automático.</p>
                                <button
                                    onClick={() => openModal()}
                                    className="mt-4 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg shadow hover:bg-slate-800 transition-colors flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Crear mi Primera Regla
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* 4. AUDITORÍA INFERIOR (HISTORIAL) */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-8">
                    <div className="p-5 border-b border-slate-200 bg-white flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-900">Historial de Disparos</h2>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 uppercase tracking-wider">Últimos {logs.length} registros</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600 min-w-[700px]">
                            <thead className="text-[11px] uppercase bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200 tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">CLIENTE</th>
                                    <th className="px-6 py-4">REGLA DISPARADA</th>
                                    <th className="px-6 py-4">CANAL</th>
                                    <th className="px-6 py-4">FECHA</th>
                                    <th className="px-6 py-4">ESTADO</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center">
                                            <RefreshCw className="animate-spin text-slate-300 mx-auto w-6 h-6" />
                                        </td>
                                    </tr>
                                ) : logs.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="px-6 py-12 text-center text-slate-500 font-medium">
                                            No hay disparos registrados aún. Haz clic en "Probar Ejecución" para evaluar clientes.
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log) => {
                                        const c = log.customers;
                                        const r = log.automation_rules;
                                        const clientName = c ? `${c.first_name} ${c.last_name}` : 'Desconocido';

                                        // Generar avatar
                                        const initials = c ? (c.first_name[0] + c.last_name[0]).toUpperCase() : '??';
                                        const colors = ['bg-amber-100 text-amber-700', 'bg-indigo-100 text-indigo-700', 'bg-rose-100 text-rose-700', 'bg-emerald-100 text-emerald-700', 'bg-sky-100 text-sky-700'];
                                        const colorClass = colors[(c?.first_name?.length || 0) % colors.length];

                                        const ruleTitle = r?.title || getRuleDefaults(r?.rule_type).title || 'Automatización';
                                        const dateObj = new Date(log.sent_at);
                                        const fDate = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                        const fTime = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                                        return (
                                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4 flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex flex-shrink-0 items-center justify-center font-bold text-xs ${colorClass}`}>
                                                        {initials}
                                                    </div>
                                                    <span className="font-medium text-slate-900">{clientName}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm text-slate-700 font-medium">
                                                        {ruleTitle}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase tracking-widest">
                                                        WHATSAPP {/* Simplificado para maqueta */}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-slate-700">{fDate}</div>
                                                    <div className="text-[11px] text-slate-400 font-medium">{fTime}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        {log.status === 'SENT' ? 'ENTREGADO' : log.status}
                                                    </span>
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

            {/* --- MODAL DE CREACIÓN / EDICIÓN --- */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200">
                        {/* Columna Izquierda: Formulario */}
                        <div className="flex-1 p-6 md:p-8 flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-900">{modalData.id ? 'Editar Automatización' : 'Nueva Automatización'}</h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full p-1.5 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4 flex-1">
                                {/* Título */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 block">Nombre de la campaña</label>
                                    <input
                                        type="text"
                                        value={modalData.title}
                                        onChange={(e) => setModalData({ ...modalData, title: e.target.value })}
                                        placeholder="Ej: Promo Cumpleañeros Café"
                                        className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition w-full"
                                    />
                                </div>

                                {/* Segmento */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 block">Segmento / Disparador</label>
                                    <select
                                        value={modalData.rule_type}
                                        onChange={(e) => setModalData({ ...modalData, rule_type: e.target.value })}
                                        className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition cursor-pointer w-full"
                                    >
                                        {segmentOptions.map(opt => (
                                            <option key={opt.value} value={opt.value} className="text-slate-900 bg-white">{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Canal */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 block">Canal de Envío</label>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setModalData({ ...modalData, channel: 'WHATSAPP' })}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all border ${modalData.channel === 'WHATSAPP' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            <Smartphone className="w-4 h-4" /> WhatsApp
                                        </button>
                                        <button
                                            onClick={() => setModalData({ ...modalData, channel: 'SMS' })}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition-all border ${modalData.channel === 'SMS' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            <MessageSquare className="w-4 h-4" /> SMS
                                        </button>
                                    </div>
                                </div>

                                {/* Textarea y Chips */}
                                <div>
                                    <div className="flex justify-between items-center mb-1.5 mt-2">
                                        <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">Plantilla de Mensaje</label>
                                    </div>
                                    <div className="border border-slate-300 rounded-xl bg-slate-50 focus-within:bg-white focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900 transition overflow-hidden">
                                        <div className="bg-slate-100/80 border-b border-slate-200 px-3 py-2 flex flex-wrap gap-1.5">
                                            <button onClick={() => insertTag('{nombre}')} className="bg-white border border-slate-200 text-slate-700 text-xs font-medium px-2 py-1 rounded-md hover:bg-slate-100 hover:border-slate-300 active:scale-95 transition cursor-pointer">+ {'{nombre}'}</button>
                                            <button onClick={() => insertTag('{negocio}')} className="bg-white border border-slate-200 text-slate-700 text-xs font-medium px-2 py-1 rounded-md hover:bg-slate-100 hover:border-slate-300 active:scale-95 transition cursor-pointer">+ {'{negocio}'}</button>
                                            <button onClick={() => insertTag('{sellos_faltantes}')} className="bg-white border border-slate-200 text-slate-700 text-xs font-medium px-2 py-1 rounded-md hover:bg-slate-100 hover:border-slate-300 active:scale-95 transition cursor-pointer">+ {'{sellos_faltantes}'}</button>
                                        </div>
                                        <textarea
                                            ref={textareaRef}
                                            className="w-full bg-transparent p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none resize-none min-h-[120px]"
                                            placeholder="Escribe tu mensaje aquí..."
                                            value={modalData.message_template}
                                            onChange={(e) => setModalData({ ...modalData, message_template: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mt-6 pt-5 border-t border-slate-100">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors w-full sm:w-auto"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveModal}
                                    className="flex-1 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 border border-slate-900 rounded-xl shadow hover:bg-slate-800 transition-colors"
                                >
                                    Guardar Automatización
                                </button>
                            </div>
                        </div>

                        {/* Columna Derecha: Preview Live */}
                        <div className="bg-[#EFEAE2] flex-1 border-l border-slate-200 hidden md:flex flex-col">
                            <div className="bg-slate-900 px-4 py-3 flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-700 rounded-full flex shrink-0 items-center justify-center text-white font-bold text-xs">
                                    <Smartphone className="w-4 h-4" />
                                </div>
                                <span className="text-white font-semibold text-sm">Vista Previa Cliente</span>
                            </div>

                            <div className="p-6 flex-1 flex flex-col justify-end overflow-hidden"
                                style={{ backgroundImage: 'radial-gradient(#d1cfcb 1px, transparent 1px)', backgroundSize: '20px 20px' }}>

                                {modalData.message_template.trim() ? (
                                    <div className={`mt-2 ${modalData.channel === 'WHATSAPP' ? 'bg-[#DCF8C6]' : 'bg-white'} shadow-md rounded-xl p-3.5 relative text-sm text-slate-800 self-start max-w-[95%] break-words whitespace-pre-wrap animate-in fade-in slide-in-from-bottom-2`}>
                                        <div className={`absolute top-0 left-[-6px] w-0 h-0 border-t-[8px] ${modalData.channel === 'WHATSAPP' ? 'border-t-[#DCF8C6]' : 'border-t-white'} border-l-[8px] border-l-transparent`}></div>
                                        {modalData.message_template
                                            .replace(/{nombre}/g, 'Franco Franco')
                                            .replace(/{negocio}/g, 'El Gran Café')
                                            .replace(/{sellos_faltantes}/g, '2')}
                                        <div className="text-[10px] text-slate-400 text-right mt-1 pt-1 flex justify-end items-center gap-1 mix-blend-multiply">
                                            Ahora <Check className={`w-3 h-3 ${modalData.channel === 'WHATSAPP' ? 'text-blue-500' : 'text-slate-400'}`} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white/60 backdrop-blur-sm self-center px-4 py-2 rounded-xl border border-slate-200/50 shadow-sm text-center">
                                        <p className="text-xs font-semibold text-slate-500 mb-1">Preview en Tiempo Real</p>
                                        <p className="text-[10px] text-slate-400">El mensaje interpolado se mostrará aquí.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
