"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Copy, Pencil, Store, Loader2, Check, QrCode, X, Download, MapPin, Phone, Terminal, Wifi, Star, ExternalLink } from "lucide-react";
import { ConfigFormState } from "./types";

interface BusinessHeroProps {
    businessId: string;
    form: ConfigFormState;
    setForm: React.Dispatch<React.SetStateAction<ConfigFormState>>;
    saving: boolean;
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    showFeedback: (type: 'success' | 'error', text: string) => void;
    initialName: string;
}

export function BusinessHero({ businessId, form, setForm, saving, onImageUpload, showFeedback, initialName }: BusinessHeroProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [isEditingReward, setIsEditingReward] = useState(false);
    const [isEditingTarget, setIsEditingTarget] = useState(false);
    const [isEditingColor, setIsEditingColor] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState("");

    const [address, setAddress] = useState("");
    const [isEditingAddress, setIsEditingAddress] = useState(false);

    const [phone, setPhone] = useState("");
    const [isEditingPhone, setIsEditingPhone] = useState(false);

    const [googleReviewsUrl, setGoogleReviewsUrl] = useState("");
    const [isEditingGoogleReviewsUrl, setIsEditingGoogleReviewsUrl] = useState(false);

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
            <div className="flex flex-col gap-8 w-full">
                {/* Contenedor Principal (Fila Superior) */}
                <div className="bg-white rounded-3xl border border-[#F1F1F1] p-6 sm:p-8 shadow-sm flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8 relative overflow-hidden">
                    <div className="flex items-center gap-6 z-10 w-full xl:w-auto">
                        <div className="relative shrink-0 group">
                            {form.logo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={form.logo_url} alt="Logo" className="w-[88px] h-[88px] rounded-2xl object-cover border border-[#F1F1F1] shadow-sm bg-white" />
                            ) : (
                                <div
                                    className="w-[88px] h-[88px] rounded-2xl text-white flex items-center justify-center font-bold text-4xl shadow-sm"
                                    style={{ backgroundColor: form.primary_color || "#FF1F2D" }}
                                >
                                    {form.name ? form.name.charAt(0).toUpperCase() : "?"}
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

                        <div className="flex flex-col items-start gap-1">
                            {isEditingName ? (
                                <div className="flex items-center gap-2 mb-1">
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        className="px-3 py-1.5 rounded-xl bg-[#F1F1F1] text-[#1F1F1F] font-bold border border-[#E5E5E5] focus:outline-none focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D] text-lg w-full max-w-[200px]"
                                        autoFocus
                                    />
                                    <button onClick={() => { setIsEditingName(false); }} disabled={saving} className="bg-[#FF1F2D] text-white p-2 rounded-xl border-none cursor-pointer">
                                        <Check className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => { setForm({ ...form, name: initialName }); setIsEditingName(false); }} disabled={saving} className="bg-gray-200 text-gray-700 p-2 rounded-xl border-none cursor-pointer hover:bg-gray-300 flex items-center justify-center">
                                        <span className="w-4 h-4 text-xs font-black flex items-center justify-center leading-none">✕</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-2xl font-bold text-[#1F1F1F] tracking-tight">{form.name}</h2>
                                    <button onClick={() => setIsEditingName(true)} className="text-[#8F8F8F] hover:text-[#FF1F2D] transition-colors p-1 cursor-pointer bg-transparent border-none">
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            <span className="inline-block px-3 py-1 bg-[#FFF6EE] text-[#800000] text-[10px] font-extrabold uppercase rounded border border-[#FFD9DC]">
                                CAFETERÍA DE ESPECIALIDAD
                            </span>
                            <div className="text-xs font-semibold text-[#1F1F1F]/60 mt-1">
                                Casa Matriz • Palermo
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto mt-4 xl:mt-0">
                        {/* Card 1: ID Terminal */}
                        <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-[#F9F9F9] border border-[#E5E5E5] flex-1 min-w-[160px]">
                            <div className="flex justify-between items-center w-full">
                                <span className="text-[10px] font-bold text-[#1F1F1F]/50 uppercase tracking-widest flex items-center gap-1.5">
                                    <Terminal className="w-3.5 h-3.5" /> ID Terminal
                                </span>
                                <button onClick={handleCopyId} className="text-[#8F8F8F] hover:text-[#1F1F1F] p-1.5 bg-white rounded-lg border border-[#E5E5E5] shadow-sm"><Copy className="w-3.5 h-3.5" /></button>
                            </div>
                            <div className="font-mono text-sm text-[#1F1F1F] font-semibold">{businessId.substring(0, 8)}...</div>
                        </div>

                        {/* Card 2: TAP NFC URL */}
                        <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-[#F9F9F9] border border-[#E5E5E5] flex-1 min-w-[160px]">
                            <div className="flex justify-between items-center w-full">
                                <span className="text-[10px] font-bold text-[#1F1F1F]/50 uppercase tracking-widest flex items-center gap-1.5">
                                    <Wifi className="w-3.5 h-3.5" /> TAP NFC URL
                                </span>
                                <button onClick={handleCopyLink} className="text-[#8F8F8F] hover:text-[#1F1F1F] p-1.5 bg-white rounded-lg border border-[#E5E5E5] shadow-sm"><Copy className="w-3.5 h-3.5" /></button>
                            </div>
                            <div className="font-mono text-xs text-[#1F1F1F] font-semibold truncate w-[130px]" title={`/api/tap?tag=${form.slug}`}>/api/tap?tag={form.slug}</div>
                        </div>

                        {/* Card 3: QR De Mostrador */}
                        <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-[#F9F9F9] border border-[#E5E5E5] flex-1 min-w-[160px]">
                            <div className="flex justify-between items-center w-full">
                                <span className="text-[10px] font-bold text-[#1F1F1F]/50 uppercase tracking-widest flex items-center gap-1.5">
                                    <QrCode className="w-3.5 h-3.5" /> QR Mostrador
                                </span>
                            </div>
                            <div className="flex items-center justify-between h-[28px] mt-0.5">
                                <span className="text-[11px] font-semibold text-[#1F1F1F]/60">Listo para imprimir</span>
                                <button onClick={() => setShowQrModal(true)} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-[#1F1F1F] hover:bg-black px-2.5 py-1.5 rounded-lg transition-colors">
                                    <Download className="w-3 h-3" /> PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Fila Inferior (Metadata) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 mt-6 border-t border-gray-100">
                    <div className="flex items-start justify-between gap-3 group">
                        <div className="flex items-start gap-3 w-full">
                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 shrink-0 border border-gray-100/50">
                                <MapPin className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col flex-1 w-full">
                                <span className="text-[11px] font-bold text-gray-400/80 uppercase tracking-wide">Dirección Física del Local</span>
                                {isEditingAddress ? (
                                    <div className="flex bg-[#F9F9F9] rounded-lg mt-0.5 border border-[#E5E5E5] focus-within:border-[#FF1F2D] overflow-hidden group/input">
                                        <input autoFocus type="text" value={address} onChange={e => setAddress(e.target.value)} onBlur={() => setIsEditingAddress(false)} className="w-full text-sm font-semibold px-2.5 py-1.5 focus:outline-none bg-transparent" placeholder="Ej. Av. 18 de Julio..." />
                                        <button className="bg-[#FF1F2D] text-white px-2 py-1"><Check className="w-3.5 h-3.5" /></button>
                                    </div>
                                ) : (
                                    <span className={`text-sm mt-0.5 ${address ? 'font-semibold text-gray-800' : 'font-medium text-gray-400'}`}>{address || "Ej. Av. 18 de Julio 1234, Local 3"}</span>
                                )}
                            </div>
                        </div>
                        {!isEditingAddress && (
                            <button onClick={() => setIsEditingAddress(true)} className="p-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Pencil className="w-3.5 h-3.5 text-gray-300 hover:text-gray-600 transition-colors" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-start justify-between gap-3 group">
                        <div className="flex items-start gap-3 w-full">
                            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 shrink-0 border border-gray-100/50">
                                <Phone className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col flex-1 w-full">
                                <span className="text-[11px] font-bold text-gray-400/80 uppercase tracking-wide">Teléfono / WhatsApp Local</span>
                                {isEditingPhone ? (
                                    <div className="flex bg-[#F9F9F9] rounded-lg mt-0.5 border border-[#E5E5E5] focus-within:border-[#FF1F2D] overflow-hidden group/input">
                                        <input autoFocus type="text" value={phone} onChange={e => setPhone(e.target.value)} onBlur={() => setIsEditingPhone(false)} className="w-full text-sm font-semibold px-2.5 py-1.5 focus:outline-none bg-transparent" placeholder="Ej. +598 99..." />
                                        <button className="bg-[#FF1F2D] text-white px-2 py-1"><Check className="w-3.5 h-3.5" /></button>
                                    </div>
                                ) : (
                                    <span className={`text-sm mt-0.5 ${phone ? 'font-semibold text-gray-800' : 'font-medium text-gray-400'}`}>{phone || "Ej. +598 99 123 456"}</span>
                                )}
                            </div>
                        </div>
                        {!isEditingPhone && (
                            <button onClick={() => setIsEditingPhone(true)} className="p-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Pencil className="w-3.5 h-3.5 text-gray-300 hover:text-gray-600 transition-colors" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-start justify-between gap-3 group">
                        <div className="flex items-start gap-3 w-full">
                            <div className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-500 shrink-0 border border-yellow-100/50">
                                <Star className="w-4 h-4 fill-yellow-500" />
                            </div>
                            <div className="flex flex-col flex-1 w-full overflow-hidden">
                                <span className="text-[11px] font-bold text-gray-400/80 uppercase tracking-wide">PERFIL GOOGLE MAPS / RESEÑAS</span>
                                {isEditingGoogleReviewsUrl ? (
                                    <div className="flex bg-[#F9F9F9] rounded-lg mt-0.5 border border-[#E5E5E5] focus-within:border-[#FF1F2D] overflow-hidden group/input">
                                        <input autoFocus type="text" value={googleReviewsUrl} onChange={e => setGoogleReviewsUrl(e.target.value)} onBlur={() => setIsEditingGoogleReviewsUrl(false)} className="w-full text-sm font-semibold px-2.5 py-1.5 focus:outline-none bg-transparent" placeholder="Ej. https://g.page/r/..." />
                                        <button className="bg-[#FF1F2D] text-white px-2 py-1"><Check className="w-3.5 h-3.5" /></button>
                                    </div>
                                ) : (
                                    <div className="mt-0.5 w-full">
                                        {googleReviewsUrl ? (
                                            <a href={googleReviewsUrl.startsWith('http') ? googleReviewsUrl : `https://${googleReviewsUrl}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#FF1F2D] hover:underline flex items-center gap-1.5 truncate max-w-[200px] xl:max-w-[250px]">
                                                {googleReviewsUrl.replace(/^https?:\/\//, '')} <ExternalLink className="w-3 h-3 shrink-0" />
                                            </a>
                                        ) : (
                                            <span className="text-sm font-medium text-gray-400">Ej. https://maps.app...</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        {!isEditingGoogleReviewsUrl && (
                            <button onClick={() => setIsEditingGoogleReviewsUrl(true)} className="p-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                                <Pencil className="w-3.5 h-3.5 text-gray-300 hover:text-gray-600 transition-colors" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal QR Code */}
            {
                showQrModal && (
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
                )
            }
        </>
    );
}
