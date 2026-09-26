"use client";
import React, { useState } from 'react';
import { UserIcon, Phone, Calendar, Loader2, AlertCircle } from "lucide-react";
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ClientForm({ business }: { business: any }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [birthdate, setBirthdate] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const router = useRouter();
    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg('');

        try {
            if (!phone || phone.length < 5) throw new Error("Por favor, ingresa un teléfono de WhatsApp válido.");
            const names = name.trim().split(' ');
            const firstName = names[0];
            const lastName = names.slice(1).join(' ') || "Cliente";

            const { data: existingCustomer } = await supabase
                .from('customers')
                .select('id')
                .eq('phone', phone)
                .eq('business_id', business.id)
                .maybeSingle();

            let customerId;

            if (existingCustomer) {
                customerId = existingCustomer.id;
                const { error: upErr } = await supabase
                    .from('customers')
                    .update({
                        first_name: firstName,
                        last_name: lastName,
                        birthdate: birthdate || undefined
                    })
                    .eq('id', customerId);
                if (upErr) throw upErr;
            } else {
                const uniqueCodeStr = "CLI-" + Math.floor(10000 + Math.random() * 90000);
                const { data: newCustomer, error: inErr } = await supabase
                    .from('customers')
                    .insert([{
                        business_id: business.id,
                        unique_code: uniqueCodeStr,
                        first_name: firstName,
                        last_name: lastName,
                        phone: phone,
                        birthdate: birthdate || new Date().toISOString(),
                        current_stamps: 1,
                        total_visits: 1
                    }])
                    .select('id')
                    .single();

                if (inErr) throw inErr;
                customerId = newCustomer.id;

                await supabase.from('stamp_logs').insert([{
                    customer_id: customerId,
                    business_id: business.id,
                    method: 'QR'
                }]);
            }

            document.cookie = `mimo_customer_token=${customerId}; path=/; max-age=31536000`;
            router.push(`/tarjeta/${customerId}`);

        } catch (err: any) {
            console.error(err);
            setErrorMsg(err.message || 'Ocurrió un error al procesar el registro.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FFF6EE] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-[#FFD9DC]/50 max-w-sm w-full mx-auto my-auto text-center">
                <div className="mb-6 flex flex-col items-center">
                    {business.logo_url ? (
                        <div className="w-16 h-16 rounded-full overflow-hidden mb-4 border-2 border-[#FFD9DC] shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={business.logo_url} alt={business.name} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 bg-[#FFF6EE] text-[#FF1F2D] font-bold text-2xl flex items-center justify-center rounded-full mb-4 border border-[#FFD9DC]">
                            {business.name.charAt(0)}
                        </div>
                    )}
                    <span className="inline-block px-3 py-1 mb-3 text-[10px] uppercase tracking-wider font-bold bg-[#FFD9DC]/30 text-[#FF1F2D]/80 rounded-full">
                        Programa de Fidelización Oficial
                    </span>
                    <h1 className="text-2xl font-semibold text-[#1F1F1F] leading-tight mb-2 tracking-tight">
                        Unite al club de <br /> {business.name}
                    </h1>
                    <p className="text-sm font-medium text-slate-500 leading-relaxed mt-1">
                        Completá tus datos para empezar a sumar sellos y desbloquear {business.reward_description || 'tu premio'}.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
                    {errorMsg && (
                        <div className="bg-[#FFD9DC] text-[#FF1F2D] p-3 rounded-2xl flex items-center gap-2 text-sm font-semibold">
                            <AlertCircle size={16} className="shrink-0" />
                            {errorMsg}
                        </div>
                    )}

                    <div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                                <UserIcon size={18} />
                            </div>
                            <input
                                type="text"
                                required
                                placeholder="Ej. Franco"
                                className="w-full bg-[#F9FAFB] pl-11 pr-4 py-3 border border-[#E5E7EB] rounded-2xl focus:ring-1 focus:ring-[#FF1F2D] focus:border-[#FF1F2D] outline-none transition text-[#1F1F1F] font-medium text-sm shadow-sm"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                                <Phone size={18} />
                            </div>
                            <input
                                type="tel"
                                required
                                placeholder="Ej. 099 123 456"
                                className="w-full bg-[#F9FAFB] pl-11 pr-4 py-3 border border-[#E5E7EB] rounded-2xl focus:ring-1 focus:ring-[#FF1F2D] focus:border-[#FF1F2D] outline-none transition text-[#1F1F1F] font-medium text-sm shadow-sm"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                                <Calendar size={18} />
                            </div>
                            <input
                                type="date"
                                className="w-full bg-[#F9FAFB] pl-11 pr-4 py-3 border border-[#E5E7EB] rounded-2xl focus:ring-1 focus:ring-[#FF1F2D] focus:border-[#FF1F2D] outline-none transition text-[#1F1F1F] font-medium text-sm shadow-sm"
                                value={birthdate}
                                onChange={(e) => setBirthdate(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5 ml-1 font-medium italic">
                            Opcional: Destacado para regalos de cumpleaños.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-2 rounded-full py-3.5 bg-[#FF1F2D] hover:bg-[#E01825] text-white font-medium text-sm transition-all shadow-sm flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 size={18} className="animate-spin text-white" /> : "Quiero unirme y sumar mi primer sello"}
                    </button>
                </form>
            </div>
        </div>
    );
}
