"use client";

import { useState, useEffect, type FormEvent } from "react";
import { ArrowRight, Loader2, Phone, Smile } from "lucide-react";
import Image from "next/image";

export default function OnboardingForm({ slug, businessName, rewardDescription }: { slug: string; businessName: string; rewardDescription: string }) {
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [fechaNacimiento, setFechaNacimiento] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);
    const [customerId, setCustomerId] = useState("");
    const [isGeneratingWallet, setIsGeneratingWallet] = useState(false);

    useEffect(() => {
        // Detectamos OS en el cliente
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
        if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
            setIsIOS(true);
        } else if (/android/i.test(ua)) {
            setIsAndroid(true);
        }
    }, []);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");

        try {
            const response = await fetch("/api/unirse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug, nombre, telefono, fechaNacimiento }),
            });

            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "No pudimos completar el registro.");

            setCustomerId(payload.customerId);
            setSuccess(true);
        } catch (err: any) {
            setError(err instanceof Error ? err.message : "Algo salió mal. Por favor, intentá de nuevo.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleWallet(wallet: string) {
        if (wallet === "Google Wallet" && customerId) {
            setIsGeneratingWallet(true);
            try {
                const response = await fetch("/api/wallet/generate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ customerId })
                });
                const payload = await response.json();
                if (!response.ok || !payload.saveUrl) {
                    throw new Error(payload.error || "No pudimos generar el pase.");
                }
                window.location.href = payload.saveUrl;
            } catch (err: any) {
                alert(err.message || "Algo salió mal.");
                setIsGeneratingWallet(false);
            }
        } else {
            alert(`El soporte para descargar en ${wallet} estará activo pronto.`);
        }
    }

    if (success) {
        return (
            <div className="animate-in fade-in zoom-in duration-300 w-full mt-4">
                <div className="bg-white rounded-[24px] p-8 text-center shadow-md border border-gray-100 flex flex-col items-center justify-center">
                    <div className="h-16 w-16 bg-[#FFEBEA] rounded-full flex items-center justify-center text-[#E53935] mb-5">
                        <svg xmlns="http://www.w3.org/7000/svg" width="32" height="32" fill="currentColor" viewBox="0 0 256 256">
                            <path d="M176.49,95.51a12,12,0,0,1,0,17l-56,56a12,12,0,0,1-17,0l-24-24a12,12,0,1,1,17-17L112,143l47.51-47.52A12,12,0,0,1,176.49,95.51ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Z"></path>
                        </svg>
                    </div>
                    <h3 className="text-2xl font-extrabold mb-1.5 text-[#1F1F1F]">¡Listo, {nombre}!</h3>
                    <p className="text-[16px] text-gray-500 mb-8 font-medium">Tu primer sello ya está adentro.</p>

                    <div className="w-full flex flex-col gap-3.5 mt-2">
                        {(!isAndroid) && (
                            <button onClick={() => handleWallet("Apple Wallet")} className="w-full bg-black text-white rounded-2xl py-[16px] px-4 flex items-center justify-center gap-2 hover:bg-gray-900 active:scale-[0.98] transition-all">
                                <span className="font-semibold tracking-wide text-[16px]">Agregar a Apple Wallet</span>
                            </button>
                        )}
                        {(!isIOS) && (
                            <button onClick={() => handleWallet("Google Wallet")} disabled={isGeneratingWallet} className="w-full bg-white text-[#3c4043] border border-[#dadce0] rounded-2xl py-[16px] px-4 flex items-center justify-center gap-2 hover:bg-[#f8f9fa] active:scale-[0.98] transition-all shadow-sm disabled:opacity-70">
                                {isGeneratingWallet ? <Loader2 size={20} className="animate-spin" /> : <span className="font-semibold tracking-wide text-[16px]">Guardar en Google Wallet</span>}
                            </button>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 w-full text-center">
                        <p className="text-[14px] text-gray-500 font-medium">No te olvides de avisar en caja que ya te sumaste a <strong>{businessName}</strong>.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#FFEBEA] mb-8 text-center ring-1 ring-black/[0.03] animate-in fade-in duration-300">
                <span className="inline-block bg-[#FFEBEA] text-[#E53935] text-[11px] font-extrabold px-3 py-1.5 rounded-full mb-4 uppercase tracking-widest">
                    ¡Primer sello de regalo!
                </span>
                <p className="text-[#1F1F1F] font-medium text-[16px] leading-snug">
                    Sumate gratis y tu primer paso hacia <strong className="text-[#E53935]">{rewardDescription || "tu recompensa"}</strong> ya está dado.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in duration-300">
                {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center font-medium border border-red-100">{error}</div>}

                <div>
                    <label className="block text-sm font-extrabold text-[#1F1F1F] mb-2 ml-1">¿Cómo te llamas?</label>
                    <div className="relative">
                        <Smile className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={19} />
                        <input
                            required
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-2xl py-3.5 pl-11 pr-4 text-[16px] outline-none focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935] transition-all shadow-sm placeholder:text-gray-400"
                            placeholder="Tu nombre o apodo"
                            autoComplete="given-name"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-extrabold text-[#1F1F1F] mb-2 ml-1">Tu número de celular</label>
                    <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={19} />
                        <input
                            required
                            type="tel"
                            value={telefono}
                            onChange={(e) => setTelefono(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-2xl py-3.5 pl-11 pr-4 text-[16px] outline-none focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935] transition-all shadow-sm placeholder:text-gray-400"
                            placeholder="+598 9X XXX XXX"
                            autoComplete="tel"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-extrabold text-[#1F1F1F] mb-1 ml-1">¿Cuándo es tu cumple? 🎂</label>
                    <p className="text-[12px] text-gray-400 font-medium ml-1 mb-2">Para mandarte un mimo en tu día especial</p>
                    <div className="relative">
                        <input
                            type="date"
                            value={fechaNacimiento}
                            onChange={(e) => setFechaNacimiento(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-2xl py-3.5 px-4 text-[16px] text-gray-500 outline-none focus:border-[#E53935] focus:ring-1 focus:ring-[#E53935] transition-all shadow-sm min-h-[50px] appearance-none"
                            autoComplete="bday"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#E53935] text-white font-bold rounded-2xl py-[16px] px-6 mt-8 flex items-center justify-center gap-2 hover:bg-[#D32F2F] active:scale-[0.98] transition-all disabled:opacity-70 shadow-md"
                >
                    {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <>Subirme <ArrowRight size={19} /></>}
                </button>

                <p className="text-center text-[12px] text-gray-500 mt-5 px-4 leading-relaxed font-medium">
                    Tus datos están protegidos. Te registrás una vez y después solo acercás tu celular en <strong>{businessName}</strong>.
                </p>
            </form>
        </>
    );
}
