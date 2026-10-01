"use client";

import React, { useState } from "react";
import { Clock, ChevronDown } from "lucide-react";
import { LocalConfigFormState, DayHourState } from "./types";

interface StampingRulesCardProps {
    localForm: LocalConfigFormState;
    setLocalForm: React.Dispatch<React.SetStateAction<LocalConfigFormState>>;
    hours: DayHourState[];
    setHours: React.Dispatch<React.SetStateAction<DayHourState[]>>;
}

export function StampingRulesCard({ localForm, setLocalForm, hours, setHours }: StampingRulesCardProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-white rounded-3xl border border-[#FFD9DC] p-6 sm:p-8 shadow-sm flex flex-col h-fit overflow-hidden">
            <div className="flex items-center justify-between cursor-pointer w-full group" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-[#FFF6EE] border border-[#FFD9DC] flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-[#FF1F2D]" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-lg font-bold text-[#1F1F1F]">Reglas de Sellado y Horarios</h3>
                        <p className="text-xs font-semibold text-[#1F1F1F]/50">Restricciones de Terminal</p>
                    </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[#8F8F8F] transition-transform duration-200 group-hover:text-[#FF1F2D] ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            <div className={`transition-all duration-300 ease-in-out overflow-hidden flex flex-col ${isOpen ? 'mt-6 opacity-100 flex-1' : 'max-h-0 opacity-0 mt-0 flex-none'}`}>
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
    );
}
