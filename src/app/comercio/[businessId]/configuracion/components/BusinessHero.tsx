"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Copy, Pencil, Store, Loader2, Check, QrCode, X, Download } from "lucide-react";
import { ConfigFormState } from "./types";

interface BusinessHeroProps {
    businessId: string;
    form: ConfigFormState;
    setForm: React.Dispatch<React.SetStateAction<ConfigFormState>>;
    saving: boolean;
    onSavePrimaryAttrs: (field: 'name' | 'reward_description', value: string) => Promise<void>;
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    showFeedback: (type: 'success' | 'error', text: string) => void;
}

export function BusinessHero({ businessId, form, setForm, saving, onSavePrimaryAttrs, onImageUpload, showFeedback }: BusinessHeroProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingReward, setIsEditingReward] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState("");

    const handleCopyId = () => {
        navigator.clipboard.writeText(businessId);
        showFeedback('success', 'ID de Comercio copiado.');
    };

    const nfcUrl = `${process.env.NEXT_PUBLIC_MIMO_SITE_URL || ''}/api/tap?tag=${form.slug}`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(nfcUrl);
        showFeedback('success', 'Link copiado al portapapeles.');
    };

    useEffect(() => {
        let cancelled = false;
        if (!showQrModal || !nfcUrl) {
            setQrDataUrl("");
            return;
        }

        QRCode.toDataURL(nfcUrl, {
            width: 720,
            margin: 3,
            errorCorrectionLevel: "H",
            color: { dark: "#1F1F1F", light: "#FFFFFF" },
        }).then((dataUrl) => {
            if (!cancelled) setQrDataUrl(dataUrl);
        }).catch(() => {
            if (!cancelled) setQrDataUrl("");
        });

        return () => { cancelled = true; };
    }, [showQrModal, nfcUrl]);

    const handleDownloadQr = () => {
        if (!qrDataUrl) return;
        const link = document.createElement("a");
        link.href = qrDataUrl;
        link.download = `qr-${form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
        link.click();
    };

    return (
        <>
            <div className="bg-white rounded-3xl border border-[#FFD9DC] p-6 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-8 relative overflow-hidden mb-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 z-10 flex-1">
                    <div className="relative shrink-0 group">
                        {form.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={form.logo_url} alt="Logo" className="w-[88px] h-[88px] rounded-2xl object-cover border border-[#F1F1F1] shadow-sm bg-white" />
                        ) : (
                            <div className="w-[88px] h-[88px] rounded-2xl bg-[#F1F1F1] border border-[#E5E5E5] flex items-center justify-center">
                                <Store className="w-8 h-8 text-[#8F8F8F]" />
                            </div>
                        )}
                        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={onImageUpload} />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute -bottom-2 -right-2 bg-[#FF1F2D] hover:bg-[#E01825] text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
                            title="Cambiar Logo"
                        >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pencil className="w-3.5 h-3.5" />}
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                            {isEditingName ? (
                                <div className="flex items-center gap-2 max-w-sm">
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className="px-3 py-1.5 rounded-xl bg-[#F1F1F1] text-[#1F1F1F] font-bold border border-[#E5E5E5] focus:outline-none focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D] text-lg w-full max-w-[200px]"
                                        autoFocus
                                    />
                                    <button onClick={() => { onSavePrimaryAttrs('name', form.name); setIsEditingName(false); }} disabled={saving} className="bg-[#FF1F2D] text-white p-2 rounded-xl border-none cursor-pointer">
                                        <Check className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <h2 className="text-2xl font-bold text-[#1F1F1F]">{form.name || "Tu Local"}</h2>
                                    <button onClick={() => setIsEditingName(true)} className="text-[#8F8F8F] hover:text-[#FF1F2D] transition-colors p-1 cursor-pointer bg-transparent border-none">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            <span className="px-3 py-1 bg-[#F1F1F1] text-[#1F1F1F]/70 text-xs font-bold uppercase rounded-lg border border-[#E5E5E5] tracking-wide">
                                Cafetería de Especialidad
                            </span>
                        </div>

                        <div className="flex flex-col gap-2 pt-1.5">
                            <div className="flex items-center gap-4 text-xs font-medium text-[#1F1F1F]/60">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    Terminal Online
                                </div>
                                <div>•</div>
                                <div>Punto de Fidelización</div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                <code className="text-[11px] bg-[#FFF6EE] border border-[#FFD9DC] text-[#FF1F2D] font-bold px-3 py-1.5 rounded-md">
                                    ID: {businessId.substring(0, 8)}...
                                </code>
                                <button onClick={handleCopyId} className="text-[#8F8F8F] hover:text-[#1F1F1F] bg-[#F1F1F1] p-1.5 rounded-md transition-colors" title="Copiar ID">
                                    <Copy className="w-3.5 h-3.5" />
                                </button>

                                <code className="text-[11px] bg-slate-50 border border-slate-200 text-slate-700 font-bold px-2 py-1.5 rounded-md truncate max-w-[150px]">
                                    /api/tap?tag={form.slug}
                                </code>
                                <button onClick={handleCopyLink} className="text-[#8F8F8F] hover:text-[#1F1F1F] bg-[#F1F1F1] p-1.5 rounded-md transition-colors" title="Copiar Link NFC">
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setShowQrModal(true)} className="text-[#8F8F8F] hover:text-[#FF1F2D] bg-[#F1F1F1] hover:bg-[#FFF6EE] p-1.5 rounded-md transition-colors" title="Ver Código QR">
                                    <QrCode className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-[#FFF6EE] border border-[#FFD9DC] rounded-2xl p-5 md:min-w-[320px] max-w-sm flex gap-4 shrink-0 shadow-sm relative overflow-hidden z-10 w-full xl:w-auto">
                    <div className="w-1.5 bg-[#FF1F2D] absolute left-0 top-0 bottom-0" />
                    <div className="w-full">
                        <p className="text-[10px] font-extrabold text-[#FF1F2D] tracking-wider mb-2">TARJETA DIGITAL MIMO</p>
                        <h3 className="text-[13px] font-bold text-[#1F1F1F] mb-1.5 leading-tight">
                            Meta Programada: {form.reward_target} sellos
                        </h3>
                        {isEditingReward ? (
                            <div className="flex gap-2 isolate relative z-20">
                                <input
                                    type="text"
                                    value={form.reward_description}
                                    onChange={e => setForm({ ...form, reward_description: e.target.value })}
                                    placeholder="Ej: Un Libre Múltiple"
                                    className="w-full text-xs font-semibold text-[#1F1F1F] px-3 py-2 rounded-xl bg-white border border-[#FFD9DC] focus:outline-none focus:border-[#FF1F2D] flex-1 min-w-[200px]"
                                    autoFocus
                                />
                                <button onClick={() => { onSavePrimaryAttrs('reward_description', form.reward_description); setIsEditingReward(false); }} disabled={saving} className="bg-[#FF1F2D] hover:bg-[#E01825] text-white p-2 rounded-xl shrink-0 transition-colors shadow-sm cursor-pointer z-30 border-none">
                                    <Check className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between gap-3 cursor-pointer group p-2 -mx-2 rounded-xl hover:bg-white border border-transparent hover:border-[#FFD9DC] transition-all" onClick={() => setIsEditingReward(true)}>
                                <p className="text-xs font-semibold text-[#1F1F1F]/70 leading-snug break-words">
                                    Recompensa: {form.reward_description || "Pendiente"}
                                </p>
                                <Pencil className="w-3.5 h-3.5 text-[#1F1F1F]/30 group-hover:text-[#FF1F2D] shrink-0" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal QR Code */}
            {showQrModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 text-center border border-[#E5E5E5]">
                        <div className="flex justify-between items-center text-left mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-[#1F1F1F]">Punto QR</h2>
                                <p className="text-xs font-semibold text-[#1F1F1F]/50 mt-1">Comparte o imprime para celular.</p>
                            </div>
                            <button onClick={() => setShowQrModal(false)} className="text-[#8F8F8F] hover:text-[#1F1F1F] p-1.5 rounded-xl hover:bg-[#F1F1F1] transition-colors" aria-label="Cerrar QR">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex items-center justify-center rounded-2xl bg-[#F1F1F1]/50 border border-[#E5E5E5] p-5 aspect-square relative">
                            {qrDataUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={qrDataUrl} alt="QR Code NFC URL" className="w-[85%] h-[85%] mix-blend-multiply" />
                            ) : (
                                <Loader2 className="w-8 h-8 animate-spin text-[#8F8F8F]" />
                            )}
                        </div>

                        <div className="mt-4 break-all bg-[#F1F1F1] text-[#1F1F1F]/70 text-[10px] font-bold p-3 rounded-xl border border-[#E5E5E5]">
                            {nfcUrl}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button type="button" onClick={handleDownloadQr} disabled={!qrDataUrl} className="flex-1 rounded-2xl bg-[#1F1F1F] text-white py-3.5 text-sm font-bold shadow-md hover:bg-black disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                <Download className="w-4 h-4" /> Descargar QR
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
