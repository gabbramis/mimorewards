"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { createClient } from '@/lib/supabase/client';
import { Loader2, CheckCircle2, AlertCircle, Store, Wallet, Clock, Bell, ShieldAlert, ChevronDown, Ticket, Trophy, BellRing, MessageCircle } from "lucide-react";
import { ConfigFormState, LocalConfigFormState, DayHourState } from "./components/types";
import { ConfigHeader } from "./components/ConfigHeader";
import { PasswordModal } from "./components/PasswordModal";
import { BusinessHero } from "./components/BusinessHero";
import { RewardSettings } from "./components/RewardSettings";
import { ScheduleSettings } from "./components/ScheduleSettings";
import { NotificationSettings } from "./components/NotificationSettings";
import { useBusiness } from "@/contexts/BusinessContext";

function AccordionSection({
    title, subtitle, icon, isOpen, onToggle, headerBadge, children
}: {
    id?: string; title: string; subtitle: string; icon: React.ReactNode; isOpen: boolean; onToggle: () => void; headerBadge?: React.ReactNode; children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-3xl border border-[#FFD9DC] shadow-sm flex flex-col relative overflow-hidden transition-all duration-300">
            <div className="flex items-center justify-between cursor-pointer p-6 sm:p-8 w-full group" onClick={onToggle}>
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-[#FFF6EE] border border-[#FFD9DC] flex items-center justify-center shrink-0">
                        {icon}
                    </div>
                    <div className="text-left flex flex-col items-start gap-1">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-[#1F1F1F] group-hover:text-[#FF1F2D] transition-colors">{title}</h3>
                            {headerBadge}
                        </div>
                        <p className="text-xs font-semibold text-[#1F1F1F]/50">{subtitle}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-extrabold tracking-widest uppercase text-[#8F8F8F] hidden sm:block">
                        {isOpen ? 'Desplegado' : 'Contraído'}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-[#8F8F8F] group-hover:text-[#FF1F2D] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </div>

            <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                <div className="p-6 sm:p-8 pt-0 border-t border-[#F1F1F1]">
                    {children}
                </div>
            </div>
        </div>
    );
}

export default function ConfiguracionPage({ params }: { params: Promise<{ businessId: string }> }) {
    const { businessId: resolvedBusinessId } = use(params);
    const supabase = createClient();
    const { setBusinessName, setLogoUrl, setPrimaryColor } = useBusiness();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // DB Config States
    const [initialForm, setInitialForm] = useState<ConfigFormState | null>(null);
    const [form, setForm] = useState<ConfigFormState>({
        name: "",
        slug: "",
        logo_url: "",
        reward_target: 10,
        reward_description: "",
        primary_color: "#E84538"
    });

    // LocalStorage Config States
    const [initialLocalForm, setInitialLocalForm] = useState<LocalConfigFormState | null>(null);
    const [localForm, setLocalForm] = useState<LocalConfigFormState>({
        notification_phone: "",
        alert_on_completion: false,
        weekly_summary: false,
        nfc_protection: false
    });

    // Días de la semana para horarios
    const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const [initialHours, setInitialHours] = useState<DayHourState[] | null>(null);
    const [hours, setHours] = useState<DayHourState[]>(DAYS.map(day => ({ day, isOpen: true, openTime: "09:00", closeTime: "18:00" })));

    // Draft State verification
    const isDirty = React.useMemo(() => {
        if (!initialForm || !initialLocalForm || !initialHours) return false;
        return (
            JSON.stringify(form) !== JSON.stringify(initialForm) ||
            JSON.stringify(localForm) !== JSON.stringify(initialLocalForm) ||
            JSON.stringify(hours) !== JSON.stringify(initialHours)
        );
    }, [form, initialForm, localForm, initialLocalForm, hours, initialHours]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    // Settings Modal
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [openSections, setOpenSections] = useState<string[]>(['profile']);



    const handleToggleAll = () => {
        if (openSections.length === 5) {
            setOpenSections([]);
        } else {
            setOpenSections(['profile', 'rewards', 'schedule', 'notifications', 'security']);
        }
    };

    const toggleSection = (id: string) => {
        setOpenSections(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

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
                const fetchedForm = {
                    name: business.name || "",
                    slug: business.slug || "",
                    logo_url: business.logo_url || "",
                    reward_target: business.reward_target || 10,
                    reward_description: business.reward_description || "",
                    primary_color: business.primary_color || "#E84538",
                };
                setForm(fetchedForm);
                setInitialForm(fetchedForm);
                setBusinessName(fetchedForm.name);
                setLogoUrl(fetchedForm.logo_url);
                setPrimaryColor(fetchedForm.primary_color);
            }

            if (typeof window !== "undefined") {
                const savedConf = localStorage.getItem(`mimo_config_${resolvedBusinessId}`);
                if (savedConf) {
                    const parsed = JSON.parse(savedConf);
                    const loadedLocalForm = {
                        notification_phone: parsed.notification_phone || "",
                        alert_on_completion: parsed.alert_on_completion || false,
                        weekly_summary: parsed.weekly_summary || false,
                        nfc_protection: parsed.nfc_protection || false
                    };
                    setLocalForm(loadedLocalForm);
                    setInitialLocalForm(loadedLocalForm);
                    if (parsed.hours) {
                        setHours(parsed.hours);
                        setInitialHours(parsed.hours);
                    } else {
                        setInitialHours(hours);
                    }
                } else {
                    setInitialLocalForm(localForm);
                    setInitialHours(hours);
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

            setForm(prev => ({ ...prev, logo_url: logoUrl }));
            showFeedback('success', 'Logo subido. Recuerda guardar los cambios.');
        } catch (error) {
            showFeedback('error', 'Error al subir la imagen.');
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

            const { error } = await supabase
                .from("businesses")
                .update({
                    name: form.name,
                    logo_url: form.logo_url,
                    reward_target: form.reward_target,
                    reward_description: form.reward_description,
                    slug: form.slug,
                    // primary_color omitted since it doesn't exist yet
                })
                .eq("id", resolvedBusinessId);

            if (error) throw error;

            setInitialForm(form);
            setInitialLocalForm(localForm);
            setInitialHours(hours);

            setBusinessName(form.name);
            setLogoUrl(form.logo_url);

            showFeedback('success', 'Cambios guardados correctamente.');
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
                    isDirty={isDirty}
                    onSave={handleSaveSettings}
                    onOpenSettings={() => setShowSettingsModal(true)}
                    allExpanded={openSections.length === 5}
                    onToggleAll={handleToggleAll}
                />

                <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto pb-12">
                    <AccordionSection
                        id="profile"
                        title="Perfil del Local & Conectividad"
                        subtitle="Identidad, Logo e Integración Web"
                        icon={<Store className="w-5 h-5 text-[#FF1F2D]" />}
                        isOpen={openSections.includes('profile')}
                        onToggle={() => toggleSection('profile')}
                        headerBadge={
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-full border border-green-100">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Terminal Activa</span>
                            </div>
                        }
                    >
                        <BusinessHero
                            businessId={resolvedBusinessId}
                            form={form}
                            setForm={setForm}
                            saving={saving}
                            onImageUpload={handleImageUpload}
                            showFeedback={showFeedback}
                            initialName={initialForm?.name || ""}
                        />
                    </AccordionSection>

                    <AccordionSection
                        id="rewards"
                        title="Reglas de Sellado y Recompensas"
                        subtitle="Mecánica de acumulación de sellos, premio final y pase Apple Wallet."
                        icon={
                            <div className="w-10 h-10 rounded-full bg-[#fef9ee] flex items-center justify-center shrink-0 border border-orange-100">
                                <Ticket className="w-5 h-5 text-orange-800" />
                            </div>
                        }
                        isOpen={openSections.includes('rewards')}
                        onToggle={() => toggleSection('rewards')}
                        headerBadge={
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-50 rounded-full border border-yellow-200/60">
                                <Trophy className="w-3.5 h-3.5 text-red-800" />
                                <span className="text-[10px] font-bold text-red-900 uppercase tracking-wider hidden sm:inline-block">Meta: {form.reward_target || 10} sellos = {form.reward_description || 'Premio'}</span>
                            </div>
                        }
                    >
                        <div className="w-full">
                            <RewardSettings
                                form={form}
                                setForm={setForm}
                                saving={saving}
                            />
                        </div>
                    </AccordionSection>

                    <AccordionSection
                        id="schedule"
                        title="Horarios de Operación y Bloqueo Anti-Fraude"
                        subtitle="Control de días activos, prevención de sellos fantasma y reglas cooldown."
                        icon={
                            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0 border border-gray-200">
                                <Clock className="w-5 h-5 text-gray-700" />
                            </div>
                        }
                        isOpen={openSections.includes('schedule')}
                        onToggle={() => toggleSection('schedule')}
                        headerBadge={
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${form.strict_schedule_enabled ?? true ? 'bg-green-50 border-green-200/60' : 'bg-red-50 border-red-200/60'}`}>
                                <ShieldAlert className={`w-3.5 h-3.5 ${form.strict_schedule_enabled ?? true ? 'text-green-700' : 'text-red-700'}`} />
                                <span className={`text-[10px] font-bold uppercase tracking-wider hidden sm:inline-block ${form.strict_schedule_enabled ?? true ? 'text-green-800' : 'text-red-800'}`}>
                                    {form.strict_schedule_enabled ?? true ? 'Protección Activa' : 'Protección Inactiva'}
                                </span>
                            </div>
                        }
                    >
                        <div className="w-full">
                            <ScheduleSettings
                                form={form}
                                setForm={setForm}
                                saving={saving}
                            />
                        </div>
                    </AccordionSection>

                    <AccordionSection
                        id="notifications"
                        title="Notificaciones Operativas y Alertas Críticas"
                        subtitle="Alertas push de canjes en caja, reportes semanales y detección de anomalías."
                        icon={
                            <div className="w-10 h-10 rounded-full bg-[#fef9ee] flex items-center justify-center shrink-0 border border-orange-100">
                                <BellRing className="w-5 h-5 text-orange-800" />
                            </div>
                        }
                        isOpen={openSections.includes('notifications')}
                        onToggle={() => toggleSection('notifications')}
                        headerBadge={
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-full border border-green-200/60">
                                <MessageCircle className="w-3.5 h-3.5 text-green-700" />
                                <span className="text-[10px] font-bold text-green-800 uppercase tracking-wider hidden sm:inline-block">WhatsApp API Conectada</span>
                            </div>
                        }
                    >
                        <div className="w-full">
                            <NotificationSettings
                                form={form}
                                setForm={setForm}
                                saving={saving}
                                showFeedback={showFeedback}
                            />
                        </div>
                    </AccordionSection>

                    <AccordionSection id="security" title="Seguridad de Caja, PIN de Mostrador y Permisos" subtitle="Validación y Autorizaciones" icon={<ShieldAlert className="w-5 h-5 text-[#FF1F2D]" />} isOpen={openSections.includes('security')} onToggle={() => toggleSection('security')}>
                        <div className="text-[#1F1F1F]/50 text-sm font-semibold py-12 text-center bg-[#F1F1F1] rounded-2xl border border-dashed border-[#E5E5E5]">[ Esqueleto En Construcción ]</div>
                    </AccordionSection>
                </div>
            </div>

            {/* Ignorar unused temporario */}
            <div className="hidden">
                {JSON.stringify({ form, setForm, localForm, setLocalForm, hours, setHours })}
            </div>

            <PasswordModal
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                showFeedback={showFeedback}
            />
        </div>
    );
}
