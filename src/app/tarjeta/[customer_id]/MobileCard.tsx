"use client";

import React, { useState, useEffect } from 'react';
import { Gift, Heart, Wallet, Check } from "lucide-react";
import { createClient } from '@/lib/supabase/client';

export default function MobileCard({ initialCustomer, business }: { initialCustomer: any, business: any }) {
    const [currentStamps, setCurrentStamps] = useState(initialCustomer.current_stamps || 0);
    const [isAnimating, setIsAnimating] = useState(false);
    const supabase = createClient();
    const targetStamps = business.reward_target || 10;

    useEffect(() => {
        // Escuchar cambios en los sellos (stamp_logs) para este cliente particular
        const channel = supabase
            .channel(`public:stamp_logs:customer_id=eq.${initialCustomer.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'stamp_logs',
                    filter: `customer_id=eq.${initialCustomer.id}`
                },
                (payload) => {
                    // Nuevo sello detectado!
                    // Verificamos si es REDEEM o SELLO normal
                    if (payload.new.method === 'REDEEM') {
                        setCurrentStamps(0);
                    } else {
                        setCurrentStamps((prev: number) => {
                            const next = prev + 1;
                            return next > targetStamps ? targetStamps : next;
                        });
                        // Triggerea pequeña animación
                        setIsAnimating(true);
                        setTimeout(() => setIsAnimating(false), 800);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [initialCustomer.id, supabase, targetStamps]);

    const handleWalletClick = () => {
        alert("Función de pase digital en sincronización. ¡Próximamente disponible!");
    };

    // Generar el array de círculos
    const stampsArray = Array.from({ length: targetStamps }, (_, i) => i + 1);

    return (
        <div className="min-h-screen bg-[#FFF6EE] flex flex-col justify-between p-5 font-sans mx-auto max-w-sm w-full">
            <div className="flex-1 flex flex-col">
                {/* Header Superior */}
                <div className="flex items-center gap-3 mb-8 pt-4 justify-center flex-col text-center">
                    {business.logo_url ? (
                        <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm border border-[#FFD9DC]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={business.logo_url} alt={business.name} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 font-bold text-xl tracking-tight text-[#FF1F2D]">
                            <span>{business.name}</span>
                        </div>
                    )}
                    <h1 className="text-2xl font-bold text-[#1F1F1F] tracking-tight mt-1 font-heading">
                        ¡Hola, {initialCustomer.first_name}! 👋
                    </h1>
                </div>

                {/* Tarjeta de Fidelización */}
                <div className={`bg-white rounded-[32px] p-6 shadow-sm border border-[#FFD9DC]/60 relative overflow-hidden transition-transform duration-300 ${isAnimating ? 'scale-[1.02]' : 'scale-100'}`}>
                    {/* Decoración superior */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#FFD9DC]/30 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#FFD9DC]/20 rounded-full blur-2xl pointer-events-none"></div>

                    <div className="relative z-10 flex justify-between items-center mb-6">
                        <span className="text-sm font-semibold text-[#1F1F1F] uppercase tracking-wider">Tus Sellos</span>
                        <div className="text-lg font-black text-[#FF1F2D] flex items-center gap-1 bg-[#FFF6EE] px-3 py-1 rounded-full border border-[#FFD9DC]/50 shadow-xs">
                            <span className={isAnimating ? 'animate-bounce text-[#FF1F2D]' : 'text-[#FF1F2D]'}>{currentStamps}</span>
                            <span className="text-[#FF1F2D]/50 text-sm">/ {targetStamps}</span>
                        </div>
                    </div>

                    {/* Grilla de Sellos */}
                    <div className="grid grid-cols-5 gap-3 relative z-10">
                        {stampsArray.map((stampNumber) => {
                            const isFilled = currentStamps >= stampNumber;
                            const isNewlyFilled = isFilled && currentStamps === stampNumber && isAnimating;

                            if (isFilled) {
                                return (
                                    <div
                                        key={stampNumber}
                                        className={`w-full aspect-square bg-[#FF1F2D] rounded-full flex items-center justify-center shadow-md transition-all duration-500 transform ${isNewlyFilled ? 'scale-110 shadow-[#FF1F2D]/40' : 'scale-100'}`}
                                    >
                                        <Heart size={20} className="text-white fill-current" />
                                    </div>
                                );
                            } else {
                                return (
                                    <div
                                        key={stampNumber}
                                        className="w-full aspect-square border-2 border-[#E5E7EB] bg-[#F9FAFB] rounded-full flex items-center justify-center opacity-80"
                                    >
                                        <span className="text-xs font-bold text-[#E5E7EB]">{stampNumber}</span>
                                    </div>
                                );
                            }
                        })}
                    </div>

                    {/* Caja de Próximo Premio */}
                    <div className="bg-[#FFF6EE] rounded-2xl p-4 flex items-center gap-3.5 border border-[#FFD9DC]/50 mt-8 relative z-10">
                        <div className="bg-white p-2 rounded-xl shadow-xs border border-[#FFD9DC]/30">
                            <Gift size={20} className="text-[#FF1F2D]" />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Recompensa</p>
                            <p className="text-sm font-bold text-[#1F1F1F] leading-tight">
                                {business.reward_description || 'Premio de lealtad'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Botón Apple Wallet */}
                <button
                    onClick={handleWalletClick}
                    className="bg-[#1F1F1F] hover:bg-black text-white rounded-full py-4 px-6 font-semibold text-sm flex items-center justify-center gap-2.5 w-full mt-6 shadow-md transition-all shadow-[#1F1F1F]/20"
                >
                    <Wallet size={18} />
                    Agregar a Apple Wallet
                </button>
            </div>

            {/* Footer de Marca */}
            <div className="mt-8 mb-4 text-center">
                <span className="flex items-center justify-center gap-1.5 font-bold text-sm tracking-tight text-[#FF1F2D]/80 mb-1">
                    <span>mimo</span>
                    <Heart size={12} fill="currentColor" strokeWidth={0} />
                </span>
                <p className="text-xs font-medium text-[#71717A]">
                    Detrás de cada número, hay alguien que eligió volver.
                </p>
            </div>
        </div>
    );
}
