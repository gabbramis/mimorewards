"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { createClient } from '@/lib/supabase/client';
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { ConfigFormState, LocalConfigFormState, DayHourState } from "./components/types";
import { ConfigHeader } from "./components/ConfigHeader";
import { PasswordModal } from "./components/PasswordModal";
import { BusinessHero } from "./components/BusinessHero";
import { NotificationsCard } from "./components/NotificationsCard";
import { StampingRulesCard } from "./components/StampingRulesCard";

export default function ConfiguracionPage({ params }: { params: Promise<{ businessId: string }> }) {
    const { businessId: resolvedBusinessId } = use(params);
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // DB Config States
    const [form, setForm] = useState<ConfigFormState>({
        name: "",
        slug: "",
        logo_url: "",
        reward_target: 10,
        reward_description: ""
    });

    // LocalStorage Config States
    const [localForm, setLocalForm] = useState<LocalConfigFormState>({
        notification_phone: "",
        alert_on_completion: false,
        weekly_summary: false,
        nfc_protection: false
    });

    // Días de la semana para horarios
    const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const [hours, setHours] = useState<DayHourState[]>(DAYS.map(day => ({ day, isOpen: true, openTime: "09:00", closeTime: "18:00" })));

    // Settings Modal
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const loadBusiness = useCallback(async () => {
        setLoading(true);
        try {
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError || !userData?.user) return;

            const { data: business } = await supabase
                .from("businesses")
                .select("name, logo_url, reward_target, reward_description, slug")
                .eq("id", resolvedBusinessId)
                .single();

            if (business) {
                setForm({
                    name: business.name || "",
                    slug: business.slug || "",
                    logo_url: business.logo_url || "",
                    reward_target: business.reward_target || 10,
                    reward_description: business.reward_description || "",
                });
            }

            if (typeof window !== "undefined") {
                const savedConf = localStorage.getItem(`mimo_config_${resolvedBusinessId}`);
                if (savedConf) {
                    const parsed = JSON.parse(savedConf);
                    setLocalForm({
                        notification_phone: parsed.notification_phone || "",
                        alert_on_completion: parsed.alert_on_completion || false,
                        weekly_summary: parsed.weekly_summary || false,
                        nfc_protection: parsed.nfc_protection || false
                    });
                    if (parsed.hours) setHours(parsed.hours);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [resolvedBusinessId, supabase]);

    useEffect(() => {
        if (resolvedBusinessId) {
            loadBusiness();
        }
    }, [resolvedBusinessId, loadBusiness]);

    const showFeedback = (type: 'success' | 'error', text: string) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback(null), 4000);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !resolvedBusinessId) return;
        const file = e.target.files[0];

        setSaving(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${resolvedBusinessId}-${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('logos')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('logos')
                .getPublicUrl(filePath);

            const logoUrl = publicUrlData.publicUrl;

            const { error: updateError } = await supabase
                .from("businesses")
                .update({ logo_url: logoUrl })
                .eq("id", resolvedBusinessId);

            if (updateError) throw updateError;

            setForm(prev => ({ ...prev, logo_url: logoUrl }));
            showFeedback('success', 'Logo actualizado con éxito.');
        } catch (error) {
            showFeedback('error', 'Error al subir la imagen.');
        } finally {
            setSaving(false);
        }
    };

    const handleSavePrimaryAttrs = async (field: 'name' | 'reward_description', value: string) => {
        if (!resolvedBusinessId) return;
        setSaving(true);
        try {
            const payload = { [field]: value };
            const { error } = await supabase
                .from("businesses")
                .update(payload)
                .eq("id", resolvedBusinessId);

            if (error) throw error;
            showFeedback('success', 'Actualizado correctamente.');
        } catch (error) {
            showFeedback('error', 'Error al actualizar.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!resolvedBusinessId) return;
        setSaving(true);
        try {
            if (typeof window !== "undefined") {
                localStorage.setItem(`mimo_config_${resolvedBusinessId}`, JSON.stringify({
                    ...localForm,
                    hours
                }));
            }
            showFeedback('success', 'Configuración guardada.');
        } catch (e) {
            showFeedback('error', 'Fallo al guardar. Intenta nuevamente.');
        } finally {
            setTimeout(() => setSaving(false), 300);
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
        <div className="min-h-screen bg-[#FFF6EE] w-full font-sans selection:bg-[#FF1F2D] selection:text-white">
            <div className="w-full max-w-6xl mx-auto px-6 py-8 md:px-8 space-y-8">

                {feedback && (
                    <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl flex items-center gap-3 font-semibold text-sm shadow-xl animate-in slide-in-from-bottom-2 slide-in-from-right-2 ${feedback.type === 'success' ? 'bg-[#1F1F1F] text-white border border-[#1F1F1F]' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                        {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-[#FF1F2D]" /> : <AlertCircle className="w-5 h-5" />}
                        {feedback.text}
                    </div>
                )}

                <ConfigHeader
                    businessId={resolvedBusinessId}
                    saving={saving}
                    onSave={handleSaveSettings}
                    onOpenSettings={() => setShowSettingsModal(true)}
                />

                <BusinessHero
                    businessId={resolvedBusinessId}
                    form={form}
                    setForm={setForm}
                    saving={saving}
                    onSavePrimaryAttrs={handleSavePrimaryAttrs}
                    onImageUpload={handleImageUpload}
                    showFeedback={showFeedback}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
                    <NotificationsCard
                        localForm={localForm}
                        setLocalForm={setLocalForm}
                        showFeedback={showFeedback}
                    />

                    <StampingRulesCard
                        localForm={localForm}
                        setLocalForm={setLocalForm}
                        hours={hours}
                        setHours={setHours}
                    />
                </div>
            </div>

            <PasswordModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                showFeedback={showFeedback}
            />
        </div>
    );
}
