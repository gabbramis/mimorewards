import React, { useState } from 'react';
import { ConfigFormState } from './types';
import { Megaphone, TrendingUp, AlertTriangle, UserPlus, Phone, Play } from 'lucide-react';

interface NotificationSettingsProps {
    form: ConfigFormState;
    setForm: (form: ConfigFormState) => void;
    onSavePrimaryAttrs: (field: string, value: any) => void;
    saving: boolean;
    showFeedback: (type: 'success' | 'error', text: string) => void;
}

export function NotificationSettings({ form, setForm, onSavePrimaryAttrs, saving, showFeedback }: NotificationSettingsProps) {
    const [phone, setPhone] = useState(form.alert_phone || '');

    // extra logic states
    const [redemptions, setRedemptions] = useState(form.notify_redemptions ?? true);
    const [weekly, setWeekly] = useState(form.notify_weekly_summary ?? true);
    const [fraud, setFraud] = useState(form.notify_fraud_anomaly ?? true);
    const [firstVisit, setFirstVisit] = useState(form.notify_first_visit ?? false);

    const handleSavePhone = (val: string) => {
        if (val !== form.alert_phone) {
            setForm({ ...form, alert_phone: val });
            onSavePrimaryAttrs('alert_phone', val);
        }
    };

    const handleToggle = (field: keyof ConfigFormState, value: boolean, setter: (val: boolean) => void) => {
        setter(value);
        setForm({ ...form, [field]: value });
        onSavePrimaryAttrs(field, value);
    };

    const handleTestEnvio = () => {
        if (!phone || phone.length < 5) {
            showFeedback('error', 'Debes ingresar un número válido.');
            return;
        }
        showFeedback('success', 'Mensaje de prueba enviado');
    };

    return (
        <div className="flex flex-col gap-6 w-full p-4 md:p-8 bg-white rounded-3xl">

            {/* WhatsApp / Teléfono Header Block */}
            <div className="bg-[#fcfaf8] border border-gray-100 p-6 rounded-2xl flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                    <label className="font-semibold text-gray-900 text-sm">WhatsApp / Teléfono para Alertas Críticas</label>
                    <p className="text-xs text-gray-500">Número del encargado de salón o gerente que recibirá los avisos automáticos.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-2xl">
                    <div className="flex-1 flex items-center gap-3 w-full bg-white px-4 py-3 rounded-xl border border-gray-200 focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-colors">
                        <Phone className="w-5 h-5 text-green-600" />
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            onBlur={(e) => handleSavePhone(e.target.value)}
                            disabled={saving}
                            placeholder="+598 99 123 456"
                            className="bg-transparent text-sm font-semibold text-gray-900 w-full focus:outline-none"
                        />
                    </div>
                    <button
                        onClick={handleTestEnvio}
                        disabled={saving}
                        className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
                    >
                        <Play className="w-4 h-4 text-gray-400 fill-gray-400 shrink-0" />
                        Probar Envío en Vivo
                    </button>
                </div>
            </div>

            {/* Grid 2x2 Alerts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {/* Card 1: Canjes */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4 hover:border-gray-200 transition-colors shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                            <Megaphone className="w-5 h-5 text-orange-600" />
                        </div>
                        <button
                            onClick={() => handleToggle('notify_redemptions', !redemptions, setRedemptions)}
                            disabled={saving}
                            className={`w-11 h-6 shrink-0 rounded-full flex items-center p-0.5 transition-colors relative shadow-inner ${redemptions ? 'bg-[#FF1F2D]' : 'bg-gray-200'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${redemptions ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 mb-1">Alerta de Canjes y Premios</h4>
                        <p className="text-xs text-gray-500 leading-relaxed pr-2">Recibir aviso instantáneo cuando un comensal completa su cartón o solicita canje en el salón.</p>
                    </div>
                </div>

                {/* Card 2: Semanal */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4 hover:border-gray-200 transition-colors shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                            <TrendingUp className="w-5 h-5 text-blue-600" />
                        </div>
                        <button
                            onClick={() => handleToggle('notify_weekly_summary', !weekly, setWeekly)}
                            disabled={saving}
                            className={`w-11 h-6 shrink-0 rounded-full flex items-center p-0.5 transition-colors relative shadow-inner ${weekly ? 'bg-[#FF1F2D]' : 'bg-gray-200'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${weekly ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 mb-1">Resumen Semanal de Rendimiento</h4>
                        <p className="text-xs text-gray-500 leading-relaxed pr-2">Informe condensado todos los lunes a las 09:00 con tasa de retención, sellos emitidos y canjes.</p>
                    </div>
                </div>

                {/* Card 3: Fraude */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4 hover:border-gray-200 transition-colors shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <button
                            onClick={() => handleToggle('notify_fraud_anomaly', !fraud, setFraud)}
                            disabled={saving}
                            className={`w-11 h-6 shrink-0 rounded-full flex items-center p-0.5 transition-colors relative shadow-inner ${fraud ? 'bg-[#FF1F2D]' : 'bg-gray-200'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${fraud ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 mb-1">Alerta de Fraude o Anomalía</h4>
                        <p className="text-xs text-gray-500 leading-relaxed pr-2">Aviso inmediato si un mismo dispositivo intenta registrar más de 2 lecturas en menos de 15 minutos.</p>
                    </div>
                </div>

                {/* Card 4: Primer Visita */}
                <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4 hover:border-gray-200 transition-colors shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100">
                            <UserPlus className="w-5 h-5 text-gray-600" />
                        </div>
                        <button
                            onClick={() => handleToggle('notify_first_visit', !firstVisit, setFirstVisit)}
                            disabled={saving}
                            className={`w-11 h-6 shrink-0 rounded-full flex items-center p-0.5 transition-colors relative shadow-inner ${firstVisit ? 'bg-[#FF1F2D]' : 'bg-gray-200'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${firstVisit ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 mb-1">Confirmación de Primera Visita</h4>
                        <p className="text-xs text-gray-500 leading-relaxed pr-2">Notificar al barista o encargado cuando un cliente nuevo se suma por primera vez al club Mimo.</p>
                    </div>
                </div>
            </div>

            {/* Legal Note */}
            <p className="text-xs text-gray-400 mt-2 text-center max-w-2xl mx-auto leading-relaxed">
                Los envíos masivos o promocionales a clientes aplican únicamente a comensales que hayan tildado la casilla de consentimiento en su pase Apple/Google Wallet.
            </p>

        </div>
    );
}
