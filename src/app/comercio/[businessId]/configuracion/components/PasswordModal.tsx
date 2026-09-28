"use client";

import React, { useState } from "react";
import { Shield, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    showFeedback: (type: "success" | "error", text: string) => void;
}

export function PasswordModal({ isOpen, onClose, showFeedback }: PasswordModalProps) {
    const supabase = createClient();
    const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
    const [passLoading, setPassLoading] = useState(false);

    if (!isOpen) return null;

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
            onClose();
        } catch (err: any) {
            showFeedback('error', err.message || 'Error al cambiar contraseña.');
        } finally {
            setPassLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#FFD9DC] relative">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#FFF6EE] flex items-center justify-center shrink-0">
                            <Shield className="w-5 h-5 text-[#FF1F2D]" />
                        </div>
                        <h3 className="text-[17px] font-bold text-[#1F1F1F]">Seguridad de la Cuenta</h3>
                    </div>
                    <button onClick={onClose} className="text-[#8F8F8F] hover:text-[#1F1F1F] p-1.5 rounded-xl hover:bg-[#F1F1F1] transition-colors" aria-label="Cerrar modal">
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
    );
}
