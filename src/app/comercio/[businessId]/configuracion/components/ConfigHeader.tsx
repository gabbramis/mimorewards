"use client";

import React from "react";
import { Settings, Check, Loader2 } from "lucide-react";

interface ConfigHeaderProps {
    businessId: string;
    saving: boolean;
    onSave: () => void;
    onOpenSettings: () => void;
    allExpanded: boolean;
    onToggleAll: () => void;
}

export function ConfigHeader({ businessId, saving, onSave, onOpenSettings, allExpanded, onToggleAll }: ConfigHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
            <div>
                <p className="text-[10px] sm:text-xs font-bold text-[#FF1F2D] tracking-wider mb-2 uppercase">
                    OPERACIONES & SEGURIDAD • TERMINAL #{businessId?.substring(0, 6)}
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
                    onClick={onToggleAll}
                    className="p-2 text-[#1F1F1F]/70 hover:text-[#1F1F1F] text-sm font-bold transition-colors cursor-pointer mr-2 flex items-center gap-2"
                >
                    {allExpanded ? 'Contraer todo' : 'Expandir todo'}
                </button>
                <button
                    onClick={onOpenSettings}
                    className="p-2 text-[#1F1F1F]/70 hover:text-[#1F1F1F] transition-colors cursor-pointer"
                    title="Ajustes de Seguridad"
                >
                    <Settings className="w-6 h-6" />
                </button>
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="bg-[#FF1F2D] hover:bg-[#E01825] text-white px-6 py-2.5 rounded-2xl shadow-sm text-sm font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Guardar Cambios
                </button>
            </div>
        </div>
    );
}
