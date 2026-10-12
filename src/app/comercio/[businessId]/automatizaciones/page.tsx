"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { Cake, Clock3, Gift, UserPlus, Award, Pencil, X, MessageCircle, Mail, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AutomationType = "birthday" | "inactive_customer" | "near_reward" | "reward_available" | "first_visit_followup";
type Channel = "whatsapp" | "email" | "wallet";

type AutomationRow = {
    id: string;
    business_id: string;
    type: AutomationType;
    enabled: boolean;
    channel: Channel;
    trigger_config: Record<string, number>;
    message_template: string;
    reward_id: string | null;
    send_time: string | null;
};

type Reward = { id: string; name: string; stamps_required: number };
type HistoryEvent = {
    id: string;
    channel: string | null;
    status: string;
    triggered_at: string;
    customers: { first_name: string; last_name: string } | null;
    automations: { type: AutomationType } | null;
};

type Def = {
    type: AutomationType;
    name: string;
    desc: string;
    icon: typeof Cake;
    channels: Channel[];
    triggerLabel: string | null;
    triggerKey: string | null;
    triggerDefault: number;
    triggerMin: number;
    triggerMax: number;
    triggerUnit: string;
    message: string;
    sendTime: boolean;
    sendTimeDefault: string;
    reward: boolean;
};

const DEFS: Def[] = [
    {
        type: "birthday", name: "Cumpleaños", desc: "Contactá a tus clientes cuando llegue su cumpleaños.",
        icon: Cake, channels: ["whatsapp", "email", "wallet"],
        triggerLabel: null, triggerKey: null, triggerDefault: 0, triggerMin: 0, triggerMax: 0, triggerUnit: "",
        message: "¡Feliz cumple, {{first_name}}! 🎂 Tenemos un beneficio para vos.",
        sendTime: true, sendTimeDefault: "09:00", reward: true,
    },
    {
        type: "inactive_customer", name: "Cliente inactivo", desc: "Volvé a contactar a quienes hace un tiempo no visitan tu comercio.",
        icon: Clock3, channels: ["whatsapp", "email", "wallet"],
        triggerLabel: "Días sin visita", triggerKey: "days", triggerDefault: 30, triggerMin: 1, triggerMax: 365, triggerUnit: "días",
        message: "Hace un tiempo que no te vemos 👀 Tenemos algo para vos.",
        sendTime: false, sendTimeDefault: "", reward: true,
    },
    {
        type: "near_reward", name: "Cerca de una recompensa", desc: "Avisales cuando estén a pocos sellos de completar su tarjeta.",
        icon: Award, channels: ["whatsapp", "email", "wallet"],
        triggerLabel: "Sellos restantes", triggerKey: "remaining_stamps", triggerDefault: 1, triggerMin: 1, triggerMax: 10, triggerUnit: "sello(s)",
        message: "Te falta solo {{remaining_stamps}} sello para tu próxima recompensa.",
        sendTime: false, sendTimeDefault: "", reward: false,
    },
    {
        type: "reward_available", name: "Recompensa disponible", desc: "Avisale al cliente cuando complete su tarjeta y tenga una recompensa para usar.",
        icon: Gift, channels: ["whatsapp", "email", "wallet"],
        triggerLabel: null, triggerKey: null, triggerDefault: 0, triggerMin: 0, triggerMax: 0, triggerUnit: "",
        message: "¡Completaste tu tarjeta! Ya tenés una recompensa disponible.",
        sendTime: false, sendTimeDefault: "", reward: false,
    },
    {
        type: "first_visit_followup", name: "Después de la primera visita", desc: "Intentá convertir una primera visita en una segunda.",
        icon: UserPlus, channels: ["whatsapp", "email", "wallet"],
        triggerLabel: "Días sin segunda visita", triggerKey: "days", triggerDefault: 7, triggerMin: 1, triggerMax: 90, triggerUnit: "días",
        message: "Gracias por tu primera visita ♥ Esperamos verte de nuevo pronto.",
        sendTime: false, sendTimeDefault: "", reward: true,
    },
];

const CHANNELS: { value: Channel; label: string; icon: typeof MessageCircle }[] = [
    { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { value: "email", label: "Email", icon: Mail },
    { value: "wallet", label: "Wallet", icon: Wallet },
];

const VARIABLES = ["{{first_name}}", "{{business_name}}", "{{remaining_stamps}}", "{{reward_name}}"];

const channelLabel = (c: Channel) => CHANNELS.find(x => x.value === c)?.label ?? c;

function summaryFor(def: Def, row: AutomationRow | undefined, rewards: Reward[]) {
    const channel = channelLabel(row?.channel ?? "whatsapp");
    const rewardName = row?.reward_id ? rewards.find(r => r.id === row.reward_id)?.name : null;
    const withReward = def.reward ? ` · ${rewardName ?? "Sin recompensa"}` : "";
    const time = def.sendTime ? ` · ${(row?.send_time ?? def.sendTimeDefault).slice(0, 5)}` : "";
    if (def.triggerKey && def.triggerLabel) {
        const value = row?.trigger_config?.[def.triggerKey] ?? def.triggerDefault;
        if (def.type === "inactive_customer") return `Después de ${value} días · ${channel}${withReward}`;
        if (def.type === "first_visit_followup") return `Después de ${value} días · ${channel}${withReward}`;
        return `A ${value} ${def.triggerUnit} · ${channel}`;
    }
    return `${channel}${time}${withReward}`;
}

export default function AutomatizacionesPage({ params }: { params: Promise<{ businessId: string }> }) {
    const { businessId } = use(params);
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [rows, setRows] = useState<AutomationRow[]>([]);
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [events, setEvents] = useState<HistoryEvent[]>([]);
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const [editing, setEditing] = useState<AutomationType | null>(null);
    const [formEnabled, setFormEnabled] = useState(false);
    const [formChannel, setFormChannel] = useState<Channel>("whatsapp");
    const [formTrigger, setFormTrigger] = useState<number>(0);
    const [formMessage, setFormMessage] = useState("");
    const [formReward, setFormReward] = useState("");
    const [formSendTime, setFormSendTime] = useState("09:00");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const showFeedback = (type: "success" | "error", text: string) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback(null), 3000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [{ data: dbRows }, { data: dbRewards }, { data: dbEvents }] = await Promise.all([
                supabase.from("automations").select("*").eq("business_id", businessId),
                supabase.from("rewards").select("id,name,stamps_required").eq("business_id", businessId).eq("active", true).order("is_default", { ascending: false }).order("name"),
                supabase.from("automation_events")
                    .select("id,channel,status,triggered_at,customers(first_name,last_name),automations(type)")
                    .eq("business_id", businessId).order("triggered_at", { ascending: false }).limit(30),
            ]);
            setRows((dbRows ?? []) as AutomationRow[]);
            setRewards((dbRewards ?? []) as Reward[]);
            setEvents((dbEvents ?? []) as unknown as HistoryEvent[]);
        } catch (e) {
            console.error("Error cargando automatizaciones:", e);
            showFeedback("error", "No se pudieron cargar las automatizaciones.");
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [businessId]);

    useEffect(() => {
        // The initial fetch hydrates the page from Supabase.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [businessId]);

    const rowFor = (type: AutomationType) => rows.find(r => r.type === type);

    const handleToggle = async (def: Def) => {
        const existing = rowFor(def.type);
        const next = !(existing?.enabled ?? false);
        setRows(prev => {
            if (existing) return prev.map(r => r.type === def.type ? { ...r, enabled: next } : r);
            return [...prev, {
                id: `tmp-${def.type}`, business_id: businessId, type: def.type, enabled: next,
                channel: "whatsapp" as Channel, trigger_config: {}, message_template: def.message,
                reward_id: null, send_time: def.sendTime ? def.sendTimeDefault : null,
            }];
        });
        try {
            if (existing) {
                const { error } = await supabase.from("automations").update({ enabled: next, updated_at: new Date().toISOString() }).eq("id", existing.id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase.from("automations").insert([{
                    business_id: businessId, type: def.type, enabled: next, channel: "whatsapp",
                    trigger_config: {}, message_template: def.message,
                    send_time: def.sendTime ? def.sendTimeDefault : null,
                }]).select().single();
                if (error) throw error;
                if (data) setRows(prev => prev.map(r => r.id === `tmp-${def.type}` ? data as AutomationRow : r));
            }
        } catch (e) {
            console.error("Error guardando estado:", e);
            load();
            showFeedback("error", "No se pudo guardar el cambio.");
        }
    };

    const openEdit = (def: Def) => {
        const row = rowFor(def.type);
        setEditing(def.type);
        setFormEnabled(row?.enabled ?? false);
        setFormChannel(row?.channel ?? "whatsapp");
        setFormTrigger(row?.trigger_config?.[def.triggerKey ?? ""] ?? def.triggerDefault);
        setFormMessage(row?.message_template ?? def.message);
        setFormReward(row?.reward_id ?? "");
        setFormSendTime((row?.send_time ?? def.sendTimeDefault ?? "09:00").slice(0, 5));
    };

    const insertVariable = (tag: string) => {
        const el = textareaRef.current;
        if (!el) {
            setFormMessage(prev => prev + tag);
            return;
        }
        const start = el.selectionStart ?? formMessage.length;
        const end = el.selectionEnd ?? formMessage.length;
        setFormMessage(formMessage.substring(0, start) + tag + formMessage.substring(end));
        setTimeout(() => {
            el.selectionStart = el.selectionEnd = start + tag.length;
            el.focus();
        }, 0);
    };

    const handleSave = async () => {
        if (!editing) return;
        const def = DEFS.find(d => d.type === editing);
        if (!def) return;
        if (!formMessage.trim()) {
            showFeedback("error", "El mensaje no puede estar vacío.");
            return;
        }
        const trigger = def.triggerKey
            ? { [def.triggerKey]: Math.min(def.triggerMax, Math.max(def.triggerMin, Math.floor(Number(formTrigger) || def.triggerDefault))) }
            : {};
        const payload = {
            business_id: businessId,
            type: def.type,
            enabled: formEnabled,
            channel: formChannel,
            trigger_config: trigger,
            message_template: formMessage.trim(),
            reward_id: def.reward && formReward ? formReward : null,
            send_time: def.sendTime ? formSendTime : null,
            updated_at: new Date().toISOString(),
        };
        setSaving(true);
        try {
            const existing = rowFor(def.type);
            if (existing && !existing.id.startsWith("tmp-")) {
                const { error } = await supabase.from("automations").update(payload).eq("id", existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from("automations").upsert([payload], { onConflict: "business_id,type" });
                if (error) throw error;
            }
            showFeedback("success", "Automatización guardada.");
            setEditing(null);
            load();
        } catch (e) {
            console.error("Error guardando automatización:", e);
            showFeedback("error", "No se pudo guardar. Revisá los datos.");
        } finally {
            setSaving(false);
        }
    };

    const editingDef = DEFS.find(d => d.type === editing) ?? null;
    const statusLabel = (date: string) => ({ pending: "Pendiente", sent: "Enviado", failed: "Fallido", skipped: "Omitido" }[date] ?? date);

    return (
        <div className="min-h-screen p-4 md:p-8 font-sans pb-20">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Automatizaciones</h1>
                    <p className="text-gray-500 text-sm mt-2">Configurá cuándo mimo puede volver a contactar a tus clientes según su actividad en tu programa.</p>
                </div>

                {feedback && (
                    <div className={`p-4 rounded-2xl font-medium border ${feedback.type === "success" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                        {feedback.text}
                    </div>
                )}

                {loading ? (
                    <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-gray-400 font-medium">Cargando automatizaciones…</div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {DEFS.map(def => {
                            const row = rowFor(def.type);
                            const active = row?.enabled ?? false;
                            const Icon = def.icon;
                            return (
                                <div key={def.type} className="bg-white border border-gray-100 rounded-2xl p-4 md:p-5 flex flex-col gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className={`w-11 h-11 rounded-xl flex shrink-0 items-center justify-center ${active ? "bg-[#FF1F2D]/10 text-[#FF1F2D]" : "bg-gray-100 text-gray-400"}`}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-gray-900">{def.name}</h3>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                                    {active ? "ACTIVA" : "INACTIVA"}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500 mt-0.5">{def.desc}</p>
                                        </div>
                                        <button
                                            onClick={() => handleToggle(def)}
                                            aria-label={active ? `Desactivar ${def.name}` : `Activar ${def.name}`}
                                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${active ? "bg-[#FF1F2D]" : "bg-gray-200"}`}
                                        >
                                            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${active ? "translate-x-5" : "translate-x-0.5"}`} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 flex-wrap pl-14">
                                        <p className="text-xs font-semibold text-gray-400">{summaryFor(def, row, rewards)}</p>
                                        <button
                                            onClick={() => openEdit(def)}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:border-[#FF1F2D] hover:text-[#FF1F2D] transition"
                                        >
                                            <Pencil size={13} /> {row ? "Editar" : "Configurar"}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                    <div className="p-4 md:p-5 border-b border-gray-100">
                        <h2 className="font-bold text-gray-900">Historial</h2>
                        <p className="text-xs text-gray-500 mt-1">Cuando una automatización se ejecute, vas a poder ver acá el cliente, el canal y el resultado del envío.</p>
                    </div>
                    {events.length === 0 ? (
                        <p className="p-6 text-sm text-gray-400 font-medium text-center">Todavía no hay envíos automáticos.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 md:px-5 py-3">Fecha</th>
                                        <th className="px-4 md:px-5 py-3">Cliente</th>
                                        <th className="px-4 md:px-5 py-3">Automatización</th>
                                        <th className="px-4 md:px-5 py-3">Canal</th>
                                        <th className="px-4 md:px-5 py-3 text-right">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {events.map(ev => (
                                        <tr key={ev.id}>
                                            <td className="px-4 md:px-5 py-3 font-medium text-gray-700 whitespace-nowrap">
                                                {new Date(ev.triggered_at).toLocaleDateString("es-UY", { day: "2-digit", month: "short" })}{" "}
                                                <span className="text-gray-400">{new Date(ev.triggered_at).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}</span>
                                            </td>
                                            <td className="px-4 md:px-5 py-3 font-bold text-gray-900 whitespace-nowrap">
                                                {ev.customers ? `${ev.customers.first_name} ${ev.customers.last_name}` : "—"}
                                            </td>
                                            <td className="px-4 md:px-5 py-3 text-gray-600 whitespace-nowrap">
                                                {DEFS.find(d => d.type === ev.automations?.type)?.name ?? "—"}
                                            </td>
                                            <td className="px-4 md:px-5 py-3 text-gray-600 whitespace-nowrap">{ev.channel ? channelLabel(ev.channel as Channel) : "—"}</td>
                                            <td className="px-4 md:px-5 py-3 text-right">
                                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">{statusLabel(ev.status)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {editingDef && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
                    <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg overflow-hidden max-h-[92vh] overflow-y-auto">
                        <div className="p-5 md:p-6 flex flex-col">
                            <div className="flex justify-between items-center mb-5">
                                <h2 className="text-lg font-bold text-gray-900">{editingDef.name}</h2>
                                <button onClick={() => setEditing(null)} aria-label="Cerrar" className="text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-sm text-gray-500 mb-5">Cuando pase esto → enviar esto.</p>

                            <div className="space-y-5">
                                <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-3">
                                    <span className="text-sm font-bold text-gray-800">Automatización activa</span>
                                    <button
                                        onClick={() => setFormEnabled(!formEnabled)}
                                        aria-label="Activar o desactivar"
                                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${formEnabled ? "bg-[#FF1F2D]" : "bg-gray-200"}`}
                                    >
                                        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${formEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                                    </button>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-700 mb-2 block">Canal</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {CHANNELS.map(c => {
                                            const Icon = c.icon;
                                            const selected = formChannel === c.value;
                                            return (
                                                <button
                                                    key={c.value}
                                                    type="button"
                                                    onClick={() => setFormChannel(c.value)}
                                                    aria-pressed={selected}
                                                    className={`flex items-center justify-center gap-1.5 px-2 py-3 rounded-2xl border text-xs font-bold transition min-h-[48px] ${selected ? "border-[#FF1F2D] bg-[#FF1F2D]/5 text-[#FF1F2D]" : "border-gray-200 text-gray-500"}`}
                                                >
                                                    <Icon size={15} /> {c.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {editingDef.triggerKey && (
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 mb-2 block">{editingDef.triggerLabel}</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min={editingDef.triggerMin}
                                                max={editingDef.triggerMax}
                                                value={formTrigger}
                                                onChange={e => setFormTrigger(Number(e.target.value))}
                                                className="w-28 px-4 py-3 rounded-2xl bg-[#F1F1F1] border border-[#E5E5E5] focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D] outline-none text-sm font-semibold min-h-[48px]"
                                            />
                                            <span className="text-sm text-gray-500 font-medium">{editingDef.triggerUnit}</span>
                                        </div>
                                    </div>
                                )}

                                {editingDef.sendTime && (
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 mb-2 block">Hora de envío</label>
                                        <input
                                            type="time"
                                            value={formSendTime}
                                            onChange={e => setFormSendTime(e.target.value)}
                                            className="w-40 px-4 py-3 rounded-2xl bg-[#F1F1F1] border border-[#E5E5E5] focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D] outline-none text-sm font-semibold min-h-[48px]"
                                        />
                                    </div>
                                )}

                                {editingDef.reward && (
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 mb-2 block">Recompensa (opcional)</label>
                                        <select
                                            value={formReward}
                                            onChange={e => setFormReward(e.target.value)}
                                            className="w-full px-4 py-3 rounded-2xl bg-[#F1F1F1] border border-[#E5E5E5] focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D] outline-none text-sm font-semibold min-h-[48px]"
                                        >
                                            <option value="">Sin recompensa</option>
                                            {rewards.map(r => (
                                                <option key={r.id} value={r.id}>{r.name} · {r.stamps_required} sellos</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-bold text-gray-700 mb-2 block">Mensaje</label>
                                    <textarea
                                        ref={textareaRef}
                                        value={formMessage}
                                        onChange={e => setFormMessage(e.target.value)}
                                        rows={4}
                                        maxLength={500}
                                        className="w-full px-4 py-3 rounded-2xl bg-[#F1F1F1] border border-[#E5E5E5] focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D] outline-none text-sm font-medium resize-none"
                                    />
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                        {VARIABLES.map(v => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => insertVariable(v)}
                                                className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-[#FF1F2D]/10 hover:text-[#FF1F2D] transition"
                                            >
                                                + {v}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-3">Solo se contactará a clientes que hayan aceptado recibir comunicaciones por este canal.</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mt-6">
                                <button onClick={() => setEditing(null)} className="px-5 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 transition w-full sm:w-auto min-h-[48px]">
                                    Cancelar
                                </button>
                                <button onClick={handleSave} disabled={saving} className="flex-1 px-5 py-3 text-sm font-bold text-white bg-[#FF1F2D] rounded-2xl hover:bg-[#E01825] transition disabled:opacity-50 min-h-[48px]">
                                    {saving ? "Guardando…" : "Guardar"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
