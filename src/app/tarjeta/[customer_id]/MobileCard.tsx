"use client";

import React, { useEffect, useState } from 'react';
import { Check, Gift, Heart, Loader2, Wallet, Wifi } from "lucide-react";
import { createClient } from '@/lib/supabase/client';

function Stamps({ current, target }: { current: number; target: number }) {
    return (
        <div className="m-nfc-stamps" aria-label={`${current} de ${target} sellos`}>
            {Array.from({ length: target }, (_, index) => (
                <span key={index} className={index < current ? "is-filled" : ""}>
                    {index < current ? <Heart size={15} fill="currentColor" /> : <span />}
                </span>
            ))}
        </div>
    );
}

export default function MobileCard({ initialCustomer, business, notice, googleWalletUrl, appleWalletReady }: { initialCustomer: any, business: any, notice?: string | null, googleWalletUrl?: string, appleWalletReady: boolean }) {
    const [currentStamps, setCurrentStamps] = useState(initialCustomer.current_stamps || 0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const supabase = createClient();
    const targetStamps = business.reward_target || 10;

    const downloadWalletPass = async () => {
        if (isDownloading) return;
        setIsDownloading(true);
        try {
            const fullName = `${initialCustomer.first_name} ${initialCustomer.last_name || ""}`.trim();
            const response = await fetch("/api/wallet/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerName: fullName,
                    currentStamps,
                    targetStamps,
                    businessName: business.name,
                    rewardDescription: business.reward_description || "Premio de lealtad",
                    logoUrl: business.logo_url || null,
                    qrMessage: initialCustomer.unique_code || initialCustomer.id,
                }),
            });

            if (!response.ok) {
                const errJson = await response.json().catch(() => null);
                throw new Error(errJson?.error || "No se pudo generar la tarjeta.");
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = "tarjeta-mimo.pkpass";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err: any) {
            console.error("Error al descargar tarjeta Apple Wallet:", err);
            alert(err?.message || "Ocurrió un error al descargar la tarjeta de Apple Wallet.");
        } finally {
            setIsDownloading(false);
        }
    };

    useEffect(() => {
        void fetch(`/api/customer-session/${encodeURIComponent(initialCustomer.id)}`);
    }, [initialCustomer.id]);

    useEffect(() => {
        const channel = supabase
            .channel(`public:stamp_logs:customer_id=eq.${initialCustomer.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'stamp_logs', filter: `customer_id=eq.${initialCustomer.id}` },
                (payload) => {
                    if (payload.new.method === 'REDEEM') {
                        setCurrentStamps(0);
                    } else {
                        setCurrentStamps((prev: number) => Math.min(prev + 1, targetStamps));
                        setIsAnimating(true);
                        setTimeout(() => setIsAnimating(false), 800);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [initialCustomer.id, supabase, targetStamps]);

    const handleGoogleWalletClick = () => {
        if (googleWalletUrl) {
            window.open(googleWalletUrl, '_blank');
        } else {
            alert("No se pudo generar el pase de Google Wallet en este momento.");
        }
    };

    return (
        <main className="m-nfc-page m-nfc-mobile-only">
            <header className="m-nfc-header">
                <span className="m-nfc-brand" aria-label={business.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={business.logo_url || "/images/mimo-wordmark.png"} alt={business.name} />
                </span>
                <span className="m-nfc-token"><Wifi size={14} /> TARJETA DIGITAL</span>
            </header>

            <div className="m-nfc-layout">
                <section className="m-nfc-panel" aria-live="polite">
                    <div className="m-nfc-card-view">
                        <div className="m-nfc-panel-heading">
                            <span className="m-nfc-step">TARJETA DE BENEFICIOS</span>
                            <h2>¡Hola, {initialCustomer.first_name}! 👋</h2>
                            <p>Seguí sumando sellos en {business.name} y desbloqueá tu próxima recompensa.</p>
                        </div>

                        <div className={`m-nfc-loyalty-card ${isAnimating ? 'm-nfc-loyalty-card-is-animating' : ''}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img className="m-nfc-card-logo" src={business.logo_url || "/images/mimo-wordmark.png"} alt={business.name} />
                            <div className="m-nfc-card-business">{business.name}</div>
                            <div className="m-nfc-card-balance"><strong>{currentStamps}<small>/{targetStamps} sellos</small></strong><span>1 compra = 1 sello</span></div>
                            <Stamps current={currentStamps} target={targetStamps} />
                            <div className="m-nfc-card-reward"><Gift size={19} /><span>{currentStamps >= targetStamps ? "Recompensa disponible" : "Tu próximo mimo"}<strong>{business.reward_description || 'Premio de lealtad'}</strong></span></div>
                            <div className="m-nfc-card-footer"><span>Tarjeta de beneficios</span><span>{initialCustomer.unique_code}</span></div>
                        </div>

                        {notice && <div className="m-nfc-alert m-nfc-alert-success" role="status"><Check size={16} /> {notice}</div>}

                        <div className="m-nfc-actions flex flex-col gap-2.5">
                            <button
                                type="button"
                                onClick={downloadWalletPass}
                                disabled={isDownloading}
                                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-black px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-neutral-900 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-75"
                            >
                                {isDownloading ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin text-white" />
                                        <span>Generando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Wallet size={18} className="text-white" />
                                        <span>Agregar a Apple Wallet</span>
                                    </>
                                )}
                            </button>
                            {googleWalletUrl && (
                                <button type="button" className="m-nfc-wallet-button m-nfc-wallet-google" onClick={handleGoogleWalletClick}>
                                    <Wallet size={18} /> Guardar en Google Wallet
                                </button>
                            )}
                        </div>
                        <p className="m-nfc-bottom-note">Podés consultar tus sellos y beneficios cuando quieras desde tu celular.</p>
                    </div>
                </section>
            </div>

            <footer className="m-nfc-footer">
                <div className="m-nfc-powered">
                    <span>Powered by</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/mimo-wordmark.png" width="64" height="25" alt="mimo rewards" />
                </div>
            </footer>
        </main>
    );
}
