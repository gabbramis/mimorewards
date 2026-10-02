import React, { useState, useEffect } from 'react';
import { ConfigFormState, DayHourState } from './types';
import { Lock, Timer, Info, Clock, Check, Copy, ShieldAlert } from 'lucide-react';

interface ScheduleSettingsProps {
    form: ConfigFormState;
    setForm: (form: ConfigFormState) => void;
    saving: boolean;
}

const defaultSchedule: DayHourState[] = [
    { day: "Lunes", isOpen: true, openTime: "08:00", closeTime: "20:00" },
    { day: "Martes", isOpen: true, openTime: "08:00", closeTime: "20:00" },
    { day: "Miércoles", isOpen: true, openTime: "08:00", closeTime: "20:00" },
    { day: "Jueves", isOpen: true, openTime: "08:00", closeTime: "20:00" },
    { day: "Viernes", isOpen: true, openTime: "08:00", closeTime: "20:00" },
    { day: "Sábado", isOpen: false, openTime: "08:00", closeTime: "14:00" },
    { day: "Domingo", isOpen: false, openTime: "08:00", closeTime: "14:00" }
];

export function ScheduleSettings({ form, setForm, saving }: ScheduleSettingsProps) {
    const [strictSchedule, setStrictSchedule] = useState(form.strict_schedule_enabled ?? true);

    // Manage cooldown
    const initialCooldown = form.cooldown_hours || 24;
    const isCustomCooldown = ![2, 5, 12, 24].includes(initialCooldown);
    const [cooldownMode, setCooldownMode] = useState<string>(isCustomCooldown ? "custom" : initialCooldown.toString());
    const [customCooldown, setCustomCooldown] = useState<number>(isCustomCooldown ? initialCooldown : 24);

    // Schedule logic
    const [schedule, setSchedule] = useState<DayHourState[]>(form.operating_hours || defaultSchedule);

    const handleSaveStrict = (val: boolean) => {
        setStrictSchedule(val);
        setForm({ ...form, strict_schedule_enabled: val });
    };

    const handleSaveCooldown = (val: number) => {
        setForm({ ...form, cooldown_hours: val });
    };

    const handleCooldownChange = (mode: string) => {
        setCooldownMode(mode);
        if (mode !== "custom") {
            handleSaveCooldown(parseInt(mode));
        } else {
            handleSaveCooldown(customCooldown);
        }
    };

    const handleCustomCooldownChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = parseInt(e.target.value);
        if (isNaN(val)) val = 1;
        if (val < 1) val = 1;
        if (val > 72) val = 72;
        setCustomCooldown(val);
    };

    const handleCustomCooldownBlur = () => {
        handleSaveCooldown(customCooldown);
    };

    const handleScheduleDayChange = (index: number, changes: Partial<DayHourState>) => {
        const newSchedule = [...schedule];
        newSchedule[index] = { ...newSchedule[index], ...changes };
        setSchedule(newSchedule);
        setForm({ ...form, operating_hours: newSchedule });
    };

    const handleCopyMonday = () => {
        const monday = schedule[0];
        const newSchedule = schedule.map((day, i) => {
            if (i > 0 && i < 7) { // Lunes a Domingo, copiar todos
                return { ...day, isOpen: monday.isOpen, openTime: monday.openTime, closeTime: monday.closeTime };
            }
            return day;
        });
        setSchedule(newSchedule);
        setForm({ ...form, operating_hours: newSchedule });
    };

    return (
        <div className="flex flex-col gap-8 w-full p-4 md:p-8 bg-white rounded-3xl">

            {/* Bloque de Protección de Sellado Estricta */}
            <div className="bg-[#fef9ee] border border-orange-100/80 p-5 sm:p-6 rounded-2xl flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shrink-0 border border-orange-100 shadow-sm">
                        <Lock className="w-6 h-6 text-red-800" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <h4 className="text-base font-bold text-gray-900">Protección de Sellado Estricta</h4>
                        <p className="text-sm text-gray-600 max-w-xl leading-relaxed">Bloquear terminales NFC y códigos QR fuera de horario comercial. Previene sellos accidentales o fraudulentos cuando el local está cerrado.</p>
                    </div>
                </div>
                <button
                    onClick={() => handleSaveStrict(!strictSchedule)}
                    disabled={saving}
                    className={`w-12 h-7 shrink-0 rounded-full flex items-center p-1 transition-colors relative shadow-inner ${strictSchedule ? 'bg-red-600' : 'bg-gray-300'}`}
                >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${strictSchedule ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                </button>
            </div>

            {/* Frecuencia mínima de sellado (Cooldown) */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 border-b border-gray-100 pb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0 border border-gray-200">
                        <Timer className="w-5 h-5 text-gray-600" />
                    </div>
                    <label className="font-semibold text-gray-900 text-sm">Frecuencia mínima de sellado por comensal (Cooldown):</label>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <select
                        value={cooldownMode}
                        onChange={(e) => handleCooldownChange(e.target.value)}
                        disabled={saving}
                        className="px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 min-w-[240px]"
                    >
                        <option value="2">2 horas entre sellos</option>
                        <option value="5">5 horas entre sellos</option>
                        <option value="12">12 horas entre sellos</option>
                        <option value="24">24 horas entre sellos (Recomendado)</option>
                        <option value="custom">Personalizado</option>
                    </select>

                    {cooldownMode === "custom" && (
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={72}
                                step={1}
                                value={customCooldown}
                                onChange={handleCustomCooldownChange}
                                onBlur={handleCustomCooldownBlur}
                                disabled={saving}
                                className="w-20 px-3 py-3 text-center rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-900 focus:outline-none focus:border-red-500"
                            />
                            <span className="text-sm font-semibold text-gray-500">horas</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabla de Horarios */}
            <div className="flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <h5 className="text-[13px] font-black text-gray-400 tracking-widest uppercase">Días de atención al público</h5>
                    <button
                        onClick={handleCopyMonday}
                        disabled={saving}
                        className="text-xs font-bold text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Copy className="w-3.5 h-3.5" />
                        Copiar Horario de Lunes a toda la semana
                    </button>
                </div>

                <div className="flex flex-col border border-gray-100 rounded-2xl overflow-hidden bg-gray-50">
                    {schedule.map((dayItem, index) => {
                        const isStrictDisabled = !strictSchedule;
                        return (
                            <div key={dayItem.day} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-4 transition-colors ${index !== schedule.length - 1 ? 'border-b border-gray-100' : ''} ${isStrictDisabled ? 'bg-red-50/40' : dayItem.isOpen ? 'bg-white' : 'bg-gray-50'}`}>

                                <div className="flex items-center gap-4 w-[140px] shrink-0">
                                    <button
                                        onClick={() => handleScheduleDayChange(index, { isOpen: !dayItem.isOpen })}
                                        disabled={saving || isStrictDisabled}
                                        className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors border ${isStrictDisabled ? 'bg-red-100 border-red-200 cursor-not-allowed' :
                                            dayItem.isOpen ? 'bg-red-600 border-red-600' : 'bg-white border-gray-300'
                                            }`}
                                    >
                                        {dayItem.isOpen && <Check className={`w-3.5 h-3.5 stroke-[3.5] ${isStrictDisabled ? 'text-red-300' : 'text-white'}`} />}
                                    </button>
                                    <span className={`text-sm font-bold ${isStrictDisabled ? 'text-red-400' : dayItem.isOpen ? 'text-gray-900' : 'text-gray-400'}`}>{dayItem.day}</span>
                                </div>

                                <div className={`flex items-center gap-3 flex-1 ${isStrictDisabled ? 'opacity-40 grayscale' : ''}`}>
                                    <div className={`flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 transition-opacity ${(!dayItem.isOpen || isStrictDisabled) && 'opacity-50 pointer-events-none'}`}>
                                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                                        <input
                                            type="time"
                                            value={dayItem.openTime}
                                            onChange={(e) => handleScheduleDayChange(index, { openTime: e.target.value })}
                                            disabled={!dayItem.isOpen || saving || isStrictDisabled}
                                            className="bg-transparent text-sm font-bold text-gray-900 focus:outline-none w-min"
                                        />
                                    </div>
                                    <span className="text-sm font-semibold text-gray-400">a</span>
                                    <div className={`flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 transition-opacity ${(!dayItem.isOpen || isStrictDisabled) && 'opacity-50 pointer-events-none'}`}>
                                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                                        <input
                                            type="time"
                                            value={dayItem.closeTime}
                                            onChange={(e) => handleScheduleDayChange(index, { closeTime: e.target.value })}
                                            disabled={!dayItem.isOpen || saving || isStrictDisabled}
                                            className="bg-transparent text-sm font-bold text-gray-900 focus:outline-none w-min"
                                        />
                                    </div>
                                </div>

                                <div className="w-[100px] flex justify-end shrink-0">
                                    {isStrictDisabled ? (
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 rounded-full border border-red-200/60 opacity-80">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                            <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Deshabilitado</span>
                                        </div>
                                    ) : dayItem.isOpen ? (
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 rounded-full border border-green-100">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Habilitado</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full border border-gray-200 cursor-not-allowed">
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Cerrado</span>
                                        </div>
                                    )}
                                </div>

                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Footer note */}
            <div className="flex items-start gap-3 mt-4 bg-gray-50 border border-gray-200 p-4 rounded-2xl">
                <Info className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                    <strong className="text-gray-700">Nota del servidor:</strong> El panel cuenta con un cooldown nativo activo por defecto de seguridad del lado de servidor para proteger el backend contra lecturas duplicadas en NFC, complementando cualquier configuración local.
                </p>
            </div>

        </div>
    );
}
