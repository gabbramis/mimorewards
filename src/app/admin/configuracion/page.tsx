"use client";

import React, { useState, useEffect } from "react";
import { createClient } from '@/lib/supabase/client';
import { Loader2, Palette, Gift, Store, Save, CheckCircle2, AlertCircle, Image as ImageIcon } from "lucide-react";

export default function ConfiguracionPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [form, setForm] = useState({
        name: "",
        reward_description: "",
        reward_target: 10,
        logo_url: "",
        brand_color: "#FF1F2D"
    });

    const PRESET_COLORS = ["#FF1F2D", "#000000", "#1D4ED8", "#047857", "#c026d3", "#f59e0b"];

    useEffect(() => {
        async function loadBusiness() {
            setLoading(true);
            try {
                const { data: userData, error: userError } = await supabase.auth.getUser();
                if (userError || !userData?.user) return;

                const { data: membership } = await supabase
                    .from("business_members")
                    .select("business_id")
                    .eq("user_id", userData.user.id)
                    .limit(1)
                    .maybeSingle();

                const bId = membership?.business_id || "ea6ae0d6-c8db-4b15-a09d-9726f93b7119"; // fallback to default
                setBusinessId(bId);

                const { data: business } = await supabase
                    .from("businesses")
                    .select("name, reward_description, reward_target, logo_url, brand_color")
                    .eq("id", bId)
                    .single();

                if (business) {
                    setForm({
                        name: business.name || "",
                        reward_description: business.reward_description || "",
                        reward_target: business.reward_target || 10,
                        logo_url: business.logo_url || "",
                        brand_color: business.brand_color || "#FF1F2D"
                    });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        loadBusiness();
    }, [supabase]);

    const showFeedback = (type: 'success' | 'error', text: string) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback(null), 4000);
    };

    const handleSave = async () => {
        if (!businessId) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from("businesses")
                .update({
                    reward_description: form.reward_description,
                    brand_color: form.brand_color,
                    logo_url: form.logo_url
                })
                .eq("id", businessId);

            if (error) throw error;
            showFeedback('success', 'Configuración guardada correctamente.');
        } catch (e) {
            showFeedback('error', 'Error al guardar los cambios.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FFF6EE] flex justify-center items-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#FF1F2D]" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FFF6EE] p-6 md:p-10 font-sans pb-20 selection:bg-[#FF1F2D] selection:text-white">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Encabezado */}
                <div>
                    <h1 className="text-3xl font-bold text-[#1F1F1F] tracking-tight flex items-center gap-3">
                        Configuración del Comercio
                    </h1>
                    <p className="text-[#8F8F8F] text-sm mt-2 font-medium max-w-2xl">
                        Gestiona la identidad de tu local, tus beneficios y visualiza tus tarjetas digitales en tiempo real.
                    </p>
                </div>

                {feedback && (
                    <div className={`p-4 rounded-2xl flex items-center gap-3 font-semibold text-sm shadow-sm border animate-in fade-in slide-in-from-top-2 ${feedback.type === 'success' ? 'bg-[#FFD9DC]/30 text-[#FF1F2D] border-[#FFD9DC]' : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                        {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                        {feedback.text}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* PANEL DE AJUSTES (Izquierda) */}
                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#FFD9DC] shadow-sm flex flex-col gap-8">
                        <div>
                            <h2 className="text-lg font-bold text-[#1F1F1F] flex items-center gap-2 mb-4">
                                <Gift className="w-5 h-5 text-[#FF1F2D]" /> Programa de Lealtad
                            </h2>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-[13px] font-bold text-[#1F1F1F] mb-1.5 ml-1">
                                        Recompensa Activa
                                    </label>
                                    <textarea
                                        value={form.reward_description}
                                        onChange={(e) => setForm({ ...form, reward_description: e.target.value })}
                                        placeholder="Ej: Café de especialidad gratis o Porción de torta"
                                        className="w-full px-4 py-3 min-h-[90px] resize-y rounded-2xl bg-[#F1F1F1] text-[#1F1F1F] placeholder:text-[#8F8F8F] text-sm font-medium border border-[#E5E5E5] focus:outline-none focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D] transition-all"
                                    />
                                </div>
                                <div className="opacity-90">
                                    <label className="block text-[13px] font-bold text-[#1F1F1F] mb-1.5 ml-1">
                                        Meta de Sellos
                                    </label>
                                    <input
                                        type="number"
                                        disabled
                                        value={form.reward_target}
                                        className="w-full px-4 py-3 rounded-2xl bg-[#F1F1F1] text-[#1F1F1F] text-sm font-bold border border-[#E5E5E5] cursor-not-allowed opacity-70"
                                    />
                                    <p className="text-[11px] text-[#1F1F1F]/60 mt-2 font-medium ml-1">
                                        La meta de sellos está calibrada con tu kit físico NFC y plantillas de Wallet. Para solicitar un cambio, contacta a soporte Mimo.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-[#F1F1F1] pt-6">
                            <h2 className="text-lg font-bold text-[#1F1F1F] flex items-center gap-2 mb-4">
                                <Palette className="w-5 h-5 text-[#FF1F2D]" /> Identidad de Marca
                            </h2>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-[13px] font-bold text-[#1F1F1F] mb-1.5 ml-1">
                                        Color Primario
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl border border-[#E5E5E5] overflow-hidden shrink-0 shadow-sm">
                                            <input
                                                type="color"
                                                value={form.brand_color}
                                                onChange={(e) => setForm({ ...form, brand_color: e.target.value })}
                                                className="w-full h-full p-0 border-none cursor-pointer scale-150"
                                            />
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {PRESET_COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, brand_color: color })}
                                                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 shadow-sm ${form.brand_color === color ? 'border-[#1F1F1F]' : 'border-transparent'}`}
                                                    style={{ backgroundColor: color }}
                                                    aria-label={`Seleccionar color ${color}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[13px] font-bold text-[#1F1F1F] mb-1.5 ml-1 flex items-center gap-2">
                                        Logo del Local <ImageIcon className="w-4 h-4 text-[#8F8F8F]" />
                                    </label>
                                    <input
                                        type="text"
                                        value={form.logo_url}
                                        onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                                        placeholder="https://rutaimagen.com/logo.png"
                                        className="w-full px-4 py-3 rounded-2xl bg-[#F1F1F1] text-[#1F1F1F] placeholder:text-[#8F8F8F] text-sm font-medium border border-[#E5E5E5] focus:outline-none focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D] transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-[#F1F1F1] pt-6 flex justify-end">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full sm:w-auto bg-[#FF1F2D] hover:bg-[#E01825] text-white font-bold rounded-2xl py-3.5 px-8 shadow-md transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Guardar cambios
                            </button>
                        </div>
                    </div>

                    {/* PANEL DE VISTAS PREVIAS (Derecha) */}
                    <div className="flex flex-col gap-6">
                        <h2 className="text-sm font-bold text-[#1F1F1F]/60 ml-2 uppercase tracking-wide">
                            Previsualización en tiempo real
                        </h2>

                        {/* A) Vista Previa Web - Smartphone Mockup */}
                        <div className="bg-white rounded-[40px] p-4 border-[6px] border-[#1F1F1F] shadow-xl mx-auto w-full max-w-[340px] relative overflow-hidden bg-slate-50">
                            {/* Notch mockup */}
                            <div className="absolute top-0 inset-x-0 w-24 h-5 bg-[#1F1F1F] rounded-b-xl mx-auto z-10"></div>

                            <div className="mt-8 flex flex-col items-center p-4 min-h-[400px]">
                                {form.logo_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={form.logo_url} alt="Logo local" className="w-16 h-16 object-cover rounded-xl shadow-sm bg-white mb-3" />
                                ) : (
                                    <div className="w-16 h-16 rounded-xl bg-[#F1F1F1] flex items-center justify-center mb-3">
                                        <Store className="w-6 h-6 text-[#8F8F8F]" />
                                    </div>
                                )}
                                <h1 className="text-xl font-bold text-slate-800 mb-6 text-center">{form.name || "Tu Comercio"}</h1>

                                <div className="bg-white p-5 rounded-2xl shadow-sm w-full border border-slate-100 mb-6">
                                    <div className="font-semibold text-xs text-center text-slate-500 mb-4 uppercase tracking-wider">Tu Recompensa</div>
                                    <p className="text-base font-bold text-center text-slate-800 leading-tight">
                                        {form.reward_description || "Completa tus metas para ganar recompensas exclusivas."}
                                    </p>
                                </div>

                                <div className="grid grid-cols-5 gap-3 w-full px-2">
                                    {Array.from({ length: form.reward_target }).map((_, i) => {
                                        const isStamped = i < 3; // Mocking 3 sellos llenos
                                        return (
                                            <div key={i} className="aspect-square flex items-center justify-center">
                                                <div
                                                    className={`w-full h-full rounded-full flex items-center justify-center shadow-inner transition-colors duration-300 ${isStamped ? "text-white shadow-sm" : "bg-slate-200"}`}
                                                    style={{ backgroundColor: isStamped ? form.brand_color : undefined }}
                                                >
                                                    {isStamped && <CheckCircle2 className="w-5 h-5 text-white/90" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-slate-500 mt-6 font-medium">Llevas 3 sellos</p>
                            </div>
                        </div>

                        {/* B) Vista Previa Apple Wallet Mockup */}
                        <div className="bg-[#1F1F1F] rounded-t-3xl rounded-b-xl mx-auto w-full max-w-[340px] shadow-2xl relative overflow-hidden mt-4 transition-colors duration-300" style={{ backgroundColor: form.brand_color }}>
                            {/* Cutout curve superior */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#FFF6EE] rounded-b-2xl"></div>

                            <div className="p-6 pt-8 mt-2 h-44 flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    {form.logo_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={form.logo_url} alt="Logo" className="w-12 h-12 object-contain bg-white rounded-full p-1" />
                                    ) : (
                                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                            <Store className="w-5 h-5 text-white" />
                                        </div>
                                    )}
                                    <div className="text-right">
                                        <h3 className="text-white/80 text-xs font-bold uppercase tracking-wider">Sellos</h3>
                                        <p className="text-white text-3xl font-black">3/{form.reward_target}</p>
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-white text-lg font-bold leading-tight line-clamp-1">{form.name || "Tu Comercio"}</h2>
                                    <p className="text-white/90 text-sm font-medium mt-1 line-clamp-2">
                                        {form.reward_description || "Recompensa pendiente"}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-4 text-center border-t border-white/20 flex justify-center">
                                {/* Barcode mockup visual */}
                                <div className="flex gap-1 h-12 items-center opacity-80">
                                    {[2, 4, 1, 3, 2, 5, 1, 2, 4, 2, 1, 4].map((w, i) => (
                                        <div key={i} className="bg-white h-full rounded-sm" style={{ width: `${w * 2}px` }} />
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
