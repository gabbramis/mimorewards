"use client";

import React, { useState, useEffect, use, useRef, useCallback } from "react";
import { createClient } from '@/lib/supabase/client';
import QRCode from "qrcode";
import { Loader2, Pencil, Check, Bell, Shield, Clock, Copy, Play, CheckCircle2, AlertCircle, Store, QrCode, X, Download, Settings } from "lucide-react";

export default function ConfiguracionPage({ params }: { params: Promise<{ businessId: string }> }) {
    const { businessId: resolvedBusinessId } = use(params);
    const supabase = createClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // DB Config States
    const [form, setForm] = useState({
        name: "",
        slug: "",
        logo_url: "",
        reward_target: 10,
        reward_description: ""
    });

    // LocalStorage Config States
    const [localForm, setLocalForm] = useState({
        notification_phone: "",
        alert_on_completion: false,
        weekly_summary: false,
        nfc_protection: false
    });

    // Días de la semana para horarios
    const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const [hours, setHours] = useState(DAYS.map(day => ({ day, isOpen: true, openTime: "09:00", closeTime: "18:00" })));

    // Hero Edit Mode
    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingReward, setIsEditingReward] = useState(false);

    // Settings Modal (Passwords)
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
    const [passLoading, setPassLoading] = useState(false);

    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // QR State
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState("");

    // Testing Notification
    const [testingNotification, setTestingNotification] = useState(false);

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
                setForm(prev => ({
                    ...prev,
                    name: business.name || "",
                    slug: business.slug || "",
                    logo_url: business.logo_url || "",
                    reward_target: business.reward_target || 10,
                    reward_description: business.reward_description || "",
                }));
            }

            // Cargar desde LocalStorage las configuraciones de operacion
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

    const handleCopyId = () => {
        if (resolvedBusinessId) {
            navigator.clipboard.writeText(resolvedBusinessId);
            showFeedback('success', 'ID de Comercio copiado.');
        }
    };

    const nfcUrl = `${process.env.NEXT_PUBLIC_MIMO_SITE_URL || ''}/api/tap?tag=${form.slug}`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(nfcUrl);
        showFeedback('success', 'Link copiado al portapapeles.');
    };

    useEffect(() => {
        let cancelled = false;
        if (!showQrModal || !nfcUrl) {
            setQrDataUrl("");
            return;
        }

        QRCode.toDataURL(nfcUrl, {
            width: 720,
            margin: 3,
            errorCorrectionLevel: "H",
            color: { dark: "#1F1F1F", light: "#FFFFFF" },
        }).then((dataUrl) => {
            if (!cancelled) setQrDataUrl(dataUrl);
        }).catch(() => {
            if (!cancelled) setQrDataUrl("");
        });

        return () => { cancelled = true; };
    }, [showQrModal, nfcUrl]);

    const handleDownloadQr = () => {
        if (!qrDataUrl) return;
        const link = document.createElement("a");
        link.href = qrDataUrl;
        link.download = `qr-${form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
        link.click();
    };

    // Hero Image Upload
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

            // Update only logo_url
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

    // Specifically limit the editable fields and prevent touches to slug or reward_target
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
            setIsEditingName(false);
            setIsEditingReward(false);
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
            // Manejo de configs temporales a LocalStorage para evitar error de Supabase
            if (typeof window !== "undefined") {
                localStorage.setItem(`mimo_config_${resolvedBusinessId}`, JSON.stringify({
                    ...localForm,
                    hours
                }));
            }
            showFeedback('success', 'Cambios guardados con éxito.');
        } catch (e) {
            showFeedback('error', 'Fallo al guardar. Intenta nuevamente.');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            showFeedback('error', 'Las contraseñas nuevas no coinciden');
            return;
        }
        setPassLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: passwords.new
            });
            if (error) throw error;
            showFeedback('success', 'Tu contraseña ha sido actualizada.');
            setPasswords({ current: "", new: "", confirm: "" });
            setShowSettingsModal(false);
        } catch (err: any) {
            showFeedback('error', err.message || 'Error al cambiar contraseña.');
        } finally {
            setPassLoading(false);
        }
    };

    const handleTestNotification = async () => {
        if (!localForm.notification_phone || localForm.notification_phone.length < 8) {
            showFeedback('error', 'Ingresa un número telefónico válido antes de probar.');
            return;
        }
        setTestingNotification(true);
        try {
            const response = await fetch('/api/notifications/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: localForm.notification_phone })
            });

            if (!response.ok) {
                const resError = await response.json();
                throw new Error(resError.error || 'Fallo el envío.');
            }

            showFeedback('success', `Mensaje de prueba enviado con éxito a ${localForm.notification_phone}`);
        } catch (err: any) {
            showFeedback('error', err.message || 'Error al enviar la prueba.');
        } finally {
            setTestingNotification(false);
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

                {/* 2. TOP BAR & ENCABEZADO */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                    <div>
                        <p className="text-[10px] sm:text-xs font-bold text-[#FF1F2D] tracking-wider mb-2 uppercase">
                            OPERACIONES & SEGURIDAD • TERMINAL #{resolvedBusinessId?.substring(0, 6)}
                        </p>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1F1F1F] tracking-tight">
                            Configuración del Comercio
                        </h1>
                        <p className="text-[#1F1F1F]/60 text-sm mt-2 font-medium">
                            Administra la visibilidad, seguridad y automatizaciones conectadas a tu terminal física.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="p-2 text-[#1F1F1F]/70 hover:text-[#1F1F1F] transition-colors cursor-pointer"
                            title="Ajustes de Seguridad"
                        >
                            <Settings className="w-6 h-6" />
                        </button>
                        <button
                            onClick={handleSaveSettings}
                            disabled={saving}
                            className="bg-[#FF1F2D] hover:bg-[#E01825] text-white px-6 py-2.5 rounded-2xl shadow-sm text-sm font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Guardar Cambios
                        </button>
                    </div>
                </div>

                {/* 3. HERO LIMPIO */}
                <div className="bg-white rounded-3xl border border-[#FFD9DC] p-6 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-8 relative overflow-hidden mb-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 z-10 flex-1">
                        <div className="relative shrink-0 group">
                            {form.logo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={form.logo_url} alt="Logo" className="w-[88px] h-[88px] rounded-2xl object-cover border border-[#F1F1F1] shadow-sm bg-white" />
                            ) : (
                                <div className="w-[88px] h-[88px] rounded-2xl bg-[#F1F1F1] border border-[#E5E5E5] flex items-center justify-center">
                                    <Store className="w-8 h-8 text-[#8F8F8F]" />
                                </div>
                            )}
                            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute -bottom-2 -right-2 bg-[#FF1F2D] hover:bg-[#E01825] text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
                                title="Cambiar Logo"
                            >
                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-3">
                                {isEditingName ? (
                                    <div className="flex items-center gap-2 max-w-sm">
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            className="px-3 py-1.5 rounded-xl bg-[#F1F1F1] text-[#1F1F1F] font-bold border border-[#E5E5E5] focus:outline-none focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D] text-lg w-full max-w-[200px]"
                                            autoFocus
                                        />
                                        <button onClick={() => handleSavePrimaryAttrs('name', form.name)} disabled={saving} className="bg-[#FF1F2D] text-white p-2 rounded-xl">
                                            <Check className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-2xl font-bold text-[#1F1F1F]">{form.name || "Tu Local"}</h2>
                                        <button onClick={() => setIsEditingName(true)} className="text-[#8F8F8F] hover:text-[#FF1F2D] transition-colors p-1">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                                <span className="px-3 py-1 bg-[#F1F1F1] text-[#1F1F1F]/70 text-xs font-bold uppercase rounded-lg border border-[#E5E5E5] tracking-wide">
                                    Cafetería de Especialidad
                                </span>
                            </div>

                            <div className="flex flex-col gap-2 pt-1.5">
                                <div className="flex items-center gap-4 text-xs font-medium text-[#1F1F1F]/60">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        Terminal Online
                                    </div>
                                    <div>•</div>
                                    <div>Punto de Fidelización</div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                    <code className="text-[11px] bg-[#FFF6EE] border border-[#FFD9DC] text-[#FF1F2D] font-bold px-3 py-1.5 rounded-md">
                                        ID: {resolvedBusinessId.substring(0, 8)}...
                                    </code>
                                    <button onClick={handleCopyId} className="text-[#8F8F8F] hover:text-[#1F1F1F] bg-[#F1F1F1] p-1.5 rounded-md transition-colors" title="Copiar ID">
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>

                                    <code className="text-[11px] bg-slate-50 border border-slate-200 text-slate-700 font-bold px-2 py-1.5 rounded-md truncate max-w-[150px]">
                                        /api/tap?tag={form.slug}
                                    </code>
                                    <button onClick={handleCopyLink} className="text-[#8F8F8F] hover:text-[#1F1F1F] bg-[#F1F1F1] p-1.5 rounded-md transition-colors" title="Copiar Link NFC">
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setShowQrModal(true)} className="text-[#8F8F8F] hover:text-[#FF1F2D] bg-[#F1F1F1] hover:bg-[#FFF6EE] p-1.5 rounded-md transition-colors" title="Ver Código QR">
                                        <QrCode className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#FFF6EE] border border-[#FFD9DC] rounded-2xl p-5 md:min-w-[320px] max-w-sm flex gap-4 shrink-0 shadow-sm relative overflow-hidden z-10 w-full xl:w-auto">
                        <div className="w-1.5 bg-[#FF1F2D] absolute left-0 top-0 bottom-0" />
                        <div className="w-full">
                            <p className="text-[10px] font-extrabold text-[#FF1F2D] tracking-wider mb-2">TARJETA DIGITAL MIMO</p>
                            <h3 className="text-[13px] font-bold text-[#1F1F1F] mb-1.5 leading-tight">
                                Meta Programada: {form.reward_target} sellos
                            </h3>
                            {isEditingReward ? (
                                <div className="flex gap-2 isolate relative z-20">
                                    <input
                                        type="text"
                                        value={form.reward_description}
                                        onChange={e => setForm({ ...form, reward_description: e.target.value })}
                                        placeholder="Ej: Un Libre Múltiple"
                                        className="w-full text-xs font-semibold text-[#1F1F1F] px-3 py-2 rounded-xl bg-white border border-[#FFD9DC] focus:outline-none focus:border-[#FF1F2D] flex-1 min-w-[200px]"
                                        autoFocus
                                    />
                                    <button onClick={() => handleSavePrimaryAttrs('reward_description', form.reward_description)} disabled={saving} className="bg-[#FF1F2D] hover:bg-[#E01825] text-white p-2 rounded-xl shrink-0 transition-colors shadow-sm cursor-pointer z-30">
                                        <Check className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between gap-3 cursor-pointer group p-2 -mx-2 rounded-xl hover:bg-white border border-transparent hover:border-[#FFD9DC] transition-all" onClick={() => setIsEditingReward(true)}>
                                    <p className="text-xs font-semibold text-[#1F1F1F]/70 leading-snug break-words">
                                        Recompensa: {form.reward_description || "Pendiente"}
                                    </p>
                                    <Pencil className="w-3.5 h-3.5 text-[#1F1F1F]/30 group-hover:text-[#FF1F2D] shrink-0" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 4. GRILLA 2 COLUMNAS */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">

                    {/* COLUMNA 1 */}
                    <div className="bg-white rounded-3xl border border-[#FFD9DC] p-6 sm:p-8 shadow-sm flex flex-col">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-[#FFF6EE] border border-[#FFD9DC] flex items-center justify-center shrink-0">
                                <Bell className="w-5 h-5 text-[#FF1F2D]" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-[#1F1F1F]">Notificaciones Operativas</h3>
                                <p className="text-xs font-semibold text-[#1F1F1F]/50">WhatsApp API conectada</p>
                            </div>
                        </div>

                        <div className="space-y-6 flex-1">
                            <div>
                                <label className="block text-xs font-bold text-[#1F1F1F] mb-2">WhatsApp / Teléfono para Alertas Críticas</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={localForm.notification_phone}
                                        onChange={(e) => setLocalForm({ ...localForm, notification_phone: e.target.value })}
                                        placeholder="+598 99 123 456"
                                        className="w-full px-4 py-2.5 rounded-xl bg-[#F1F1F1] text-[#1F1F1F] placeholder:text-[#8F8F8F] text-sm font-semibold border border-[#E5E5E5] focus:outline-none focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D] transition-all"
                                    />
                                    <button
                                        onClick={handleTestNotification}
                                        disabled={testingNotification}
                                        className="bg-white text-[#1F1F1F] border border-[#E5E5E5] px-4 py-2.5 rounded-xl hover:bg-[#F1F1F1] text-sm font-bold flex items-center gap-2 shrink-0 shadow-sm transition-all disabled:opacity-50"
                                    >
                                        {testingNotification ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Probar"}
                                        {!testingNotification && <Play className="w-3.5 h-3.5 fill-current" />}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-[#F1F1F1]/50 p-4 rounded-2xl space-y-4 border border-[#E5E5E5]/50">
                                <label className="flex items-start justify-between gap-4 cursor-pointer">
                                    <div className="flex-1 pr-4">
                                        <h4 className="text-sm font-bold text-[#1F1F1F] mb-0.5">Alerta de Canjes y Premios</h4>
                                        <p className="text-[11px] font-semibold text-[#1F1F1F]/60 leading-snug">
                                            Recibir un aviso instantáneo en tu terminal local cuando el usuario completó su cartón y está listo para redimir su premio.
                                        </p>
                                    </div>
                                    <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out mt-1 ${localForm.alert_on_completion ? 'bg-[#FF1F2D]' : 'bg-[#E5E5E5]'}`}>
                                        <input type="checkbox" className="sr-only" checked={localForm.alert_on_completion} onChange={(e) => setLocalForm({ ...localForm, alert_on_completion: e.target.checked })} />
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localForm.alert_on_completion ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </span>
                                </label>

                                <div className="h-px bg-[#E5E5E5]"></div>

                                <label className="flex items-start justify-between gap-4 cursor-pointer">
                                    <div className="flex-1 pr-4">
                                        <h4 className="text-sm font-bold text-[#1F1F1F] mb-0.5">Resumen Semanal de Rendimiento</h4>
                                        <p className="text-[11px] font-semibold text-[#1F1F1F]/60 leading-snug">
                                            Obtener un reporte con métricas clave de retención y volumen de escaneos.
                                        </p>
                                    </div>
                                    <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out mt-1 ${localForm.weekly_summary ? 'bg-[#FF1F2D]' : 'bg-[#E5E5E5]'}`}>
                                        <input type="checkbox" className="sr-only" checked={localForm.weekly_summary} onChange={(e) => setLocalForm({ ...localForm, weekly_summary: e.target.checked })} />
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localForm.weekly_summary ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </span>
                                </label>
                            </div>
                        </div>

                        <div className="mt-6 pt-5 border-t border-[#F1F1F1]">
                            <p className="text-[11px] font-semibold text-[#1F1F1F]/50 leading-snug text-center">
                                Los envíos masivos o promocionales a clientes aplican únicamente a quienes hayan tildado la casilla de consentimiento en su registro.
                            </p>
                        </div>
                    </div>


                    {/* COLUMNA 2 */}
                    <div className="bg-white rounded-3xl border border-[#FFD9DC] p-6 sm:p-8 shadow-sm flex flex-col h-full overflow-hidden">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-[#FFF6EE] border border-[#FFD9DC] flex items-center justify-center shrink-0">
                                <Clock className="w-5 h-5 text-[#FF1F2D]" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-[#1F1F1F]">Reglas de Sellado y Horarios</h3>
                                <p className="text-xs font-semibold text-[#1F1F1F]/50">Restricciones de Terminal</p>
                            </div>
                        </div>

                        <label className="flex items-start gap-4 cursor-pointer p-5 rounded-2xl bg-[#FFF6EE] border border-[#FFD9DC] mb-6">
                            <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out mt-0.5 shadow-inner ${localForm.nfc_protection ? 'bg-[#FF1F2D]' : 'bg-[#1F1F1F]/20'}`}>
                                <input type="checkbox" className="sr-only" checked={localForm.nfc_protection} onChange={(e) => setLocalForm({ ...localForm, nfc_protection: e.target.checked })} />
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${localForm.nfc_protection ? 'translate-x-6' : 'translate-x-1'}`} />
                            </span>
                            <div>
                                <h3 className="text-[13px] font-bold text-[#FF1F2D] mb-1">Protección de Sellado Estricta</h3>
                                <p className="text-[11px] text-[#1F1F1F]/70 font-semibold leading-snug">
                                    Bloquear terminales NFC fuera de horario. Previene sellos fantasma si el local está cerrado.
                                </p>
                            </div>
                        </label>

                        <div className="flex-1 flex flex-col">
                            <div className="grid grid-cols-12 gap-2 text-[10px] font-extrabold text-[#1F1F1F]/40 uppercase tracking-widest px-2 mb-2">
                                <div className="col-span-5">Día</div>
                                <div className="col-span-4 text-center">Horario</div>
                                <div className="col-span-3 text-right pr-6">Estado</div>
                            </div>

                            <div className="space-y-1.5 overflow-y-auto flex-1 pr-2 custom-scrollbar -mr-2">
                                {hours.map((h, i) => (
                                    <div key={h.day} className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl transition-colors border ${h.isOpen ? 'bg-[#F1F1F1]/70 border-[#E5E5E5]' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                                        <div className="col-span-5 flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={h.isOpen}
                                                onChange={(e) => {
                                                    const nh = [...hours];
                                                    nh[i].isOpen = e.target.checked;
                                                    setHours(nh);
                                                    setLocalForm(prev => ({ ...prev }));
                                                }}
                                                className="w-4 h-4 rounded border-[#E5E5E5] text-[#FF1F2D] focus:ring-[#FF1F2D] cursor-pointer"
                                            />
                                            <span className={`text-xs font-bold leading-none ${h.isOpen ? 'text-[#1F1F1F]' : 'text-[#8F8F8F]'}`}>{h.day}</span>
                                        </div>

                                        <div className="col-span-7 flex items-center justify-between">
                                            {h.isOpen ? (
                                                <div className="flex bg-white border border-[#E5E5E5] rounded-lg overflow-hidden flex-1 shrink-0">
                                                    <input type="time" value={h.openTime} onChange={(e) => { const nh = [...hours]; nh[i].openTime = e.target.value; setHours(nh); setLocalForm(prev => ({ ...prev })); }} className="w-1/2 px-2 py-1.5 text-center text-[#1F1F1F] text-[11px] font-bold focus:outline-none focus:bg-[#FFF6EE] border-r border-[#E5E5E5]" />
                                                    <input type="time" value={h.closeTime} onChange={(e) => { const nh = [...hours]; nh[i].closeTime = e.target.value; setHours(nh); setLocalForm(prev => ({ ...prev })); }} className="w-1/2 px-2 py-1.5 text-center text-[#1F1F1F] text-[11px] font-bold focus:outline-none focus:bg-[#FFF6EE]" />
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex justify-center">
                                                    <span className="text-[10px] font-bold text-[#8F8F8F] tracking-widest uppercase bg-[#F1F1F1] px-3 py-1 rounded-md">Cerrado</span>
                                                </div>
                                            )}

                                            <div className="w-14 shrink-0 flex justify-end">
                                                {h.isOpen && (
                                                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-6 pt-5 border-t border-[#F1F1F1]">
                            <p className="text-[11px] font-semibold text-[#1F1F1F]/50 leading-snug text-center">
                                Nota: El panel cuenta con un cooldown nativo activo por defecto de 3 horas de seguridad del lado de servidor para proteger el backend.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal QR Code */}
            {showQrModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 text-center border border-[#E5E5E5]">
                        <div className="flex justify-between items-center text-left mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-[#1F1F1F]">Punto QR</h2>
                                <p className="text-xs font-semibold text-[#1F1F1F]/50 mt-1">Comparte o imprime para celular.</p>
                            </div>
                            <button onClick={() => setShowQrModal(false)} className="text-[#8F8F8F] hover:text-[#1F1F1F] p-1.5 rounded-xl hover:bg-[#F1F1F1] transition-colors" aria-label="Cerrar QR">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex items-center justify-center rounded-2xl bg-[#F1F1F1]/50 border border-[#E5E5E5] p-5 aspect-square relative">
                            {qrDataUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={qrDataUrl} alt="QR Code NFC URL" className="w-[85%] h-[85%] mix-blend-multiply" />
                            ) : (
                                <Loader2 className="w-8 h-8 animate-spin text-[#8F8F8F]" />
                            )}
                        </div>

                        <div className="mt-4 break-all bg-[#F1F1F1] text-[#1F1F1F]/70 text-[10px] font-bold p-3 rounded-xl border border-[#E5E5E5]">
                            {nfcUrl}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={handleDownloadQr} disabled={!qrDataUrl} className="flex-1 rounded-2xl bg-[#1F1F1F] text-white py-3.5 text-sm font-bold shadow-md hover:bg-black disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                <Download className="w-4 h-4" /> Descargar QR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Settings / Password */}
            {showSettingsModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#FFD9DC] relative">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#FFF6EE] flex items-center justify-center shrink-0">
                                    <Shield className="w-5 h-5 text-[#FF1F2D]" />
                                </div>
                                <h3 className="text-[17px] font-bold text-[#1F1F1F]">Seguridad de la Cuenta</h3>
                            </div>
                            <button onClick={() => setShowSettingsModal(false)} className="text-[#8F8F8F] hover:text-[#1F1F1F] p-1.5 rounded-xl hover:bg-[#F1F1F1] transition-colors" aria-label="Cerrar modal">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5 ml-1">Nueva Contraseña</label>
                                <input
                                    type="password" required placeholder="Ingresa 6 caracteres mínimo"
                                    value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                    className="w-full px-4 py-3 rounded-2xl bg-[#F1F1F1] text-[#1F1F1F] text-sm font-medium border border-[#E5E5E5] focus:outline-none focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5 ml-1">Confirmar Contraseña</label>
                                <input
                                    type="password" required placeholder="Repite la contraseña"
                                    value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                    className="w-full px-4 py-3 rounded-2xl bg-[#F1F1F1] text-[#1F1F1F] text-sm font-medium border border-[#E5E5E5] focus:outline-none focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D]"
                                />
                            </div>
                            <button type="submit" disabled={passLoading} className="w-full bg-[#FF1F2D] hover:bg-[#E01825] text-white font-bold py-3.5 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 mt-4 shadow-sm active:scale-[0.98] disabled:opacity-50">
                                {passLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Actualizar Contraseña"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
