"use client";

import React, { useState } from "react";
import { Bell, Play, Loader2 } from "lucide-react";
import { LocalConfigFormState } from "./types";

interface NotificationsCardProps {
    localForm: LocalConfigFormState;
    setLocalForm: React.Dispatch<React.SetStateAction<LocalConfigFormState>>;
    showFeedback: (type: 'success' | 'error', text: string) => void;
}

export function NotificationsCard({ localForm, setLocalForm, showFeedback }: NotificationsCardProps) {
    const [testingNotification, setTestingNotification] = useState(false);

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

    return (
        <div className="bg-white rounded-3xl border border-[#FFD9DC] p-6 sm:p-8 shadow-sm flex flex-col h-full">
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
                                Recibir un aviso instantáneo local cuando el usuario completó su cartón.
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
                                Obtener un reporte con métricas clave de retención y escaneos.
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
    );
}
