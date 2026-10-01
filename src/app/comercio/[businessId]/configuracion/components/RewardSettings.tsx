import React, { useState } from 'react';
import { ConfigFormState } from './types';
import { Smartphone, Gift, Check, Coffee, Store, QrCode } from 'lucide-react';

interface RewardSettingsProps {
    form: ConfigFormState;
    setForm: (form: ConfigFormState) => void;
    onSavePrimaryAttrs: (field: string, value: string | number) => void;
    saving: boolean;
}

export function RewardSettings({ form, setForm, onSavePrimaryAttrs, saving }: RewardSettingsProps) {
    const [localRewardTarget, setLocalRewardTarget] = useState(form.reward_target || 10);
    const [localRewardDesc, setLocalRewardDesc] = useState(form.reward_description || '');

    const [walletTab, setWalletTab] = useState<'apple' | 'google'>('apple');
    const brandColor = form.primary_color || '#FF1F2D';

    // extra logic states
    const [giveWelcomeStamp, setGiveWelcomeStamp] = useState(true);
    const [expiration, setExpiration] = useState("Sin vencimiento");

    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 w-full xl:p-2 bg-white rounded-3xl">
            {/* Left Column (7 cols) */}
            <div className="xl:col-span-7 flex flex-col gap-8 md:p-6 lg:p-2">
                {/* Block 1 */}
                <div className="flex flex-col gap-3">
                    <label className="font-semibold text-gray-900 text-sm">Sellos necesarios para completar la tarjeta</label>
                    <p className="text-xs text-gray-500 mb-1">Recomendamos entre 8 y 10 consumos para maximizar la tasa de retorno en cafeterías.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl">
                        {[6, 8, 10, 12].map(num => (
                            <button
                                key={num}
                                onClick={() => {
                                    setLocalRewardTarget(num);
                                    setForm({ ...form, reward_target: num });
                                    onSavePrimaryAttrs('reward_target', num);
                                }}
                                disabled={saving}
                                className={`py-3 px-4 rounded-xl flex items-center justify-center font-bold text-sm transition-colors border ${localRewardTarget === num ? 'bg-[#b91c1c] text-white border-[#b91c1c]' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-100'}`}
                            >
                                {num} Sellos {num === 10 && '★'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Block 2 */}
                <div className="flex flex-col gap-3">
                    <label className="font-semibold text-gray-900 text-sm">Título de la Recompensa (Visible en el Wallet)</label>
                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            value={localRewardDesc}
                            onChange={(e) => setLocalRewardDesc(e.target.value)}
                            onBlur={() => {
                                if (localRewardDesc !== form.reward_description) {
                                    setForm({ ...form, reward_description: localRewardDesc });
                                    onSavePrimaryAttrs('reward_description', localRewardDesc);
                                }
                            }}
                            disabled={saving}
                            placeholder="Ej. Café de especialidad a elección"
                            className="flex-1 w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D] outline-none transition-colors font-medium text-sm"
                        />
                    </div>
                </div>

                {/* Block 3 */}
                <div className="bg-[#fef9ee] p-5 rounded-2xl border border-orange-100 flex flex-col gap-5 mt-2">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex flex-col w-[70%]">
                            <h4 className="font-semibold text-gray-900 text-sm">Regalar 1er sello de bienvenida</h4>
                            <p className="text-xs text-gray-600 mt-1 leading-relaxed">Otorga automáticamente un sello al registrarse en el mostrador.</p>
                        </div>
                        <button
                            onClick={() => setGiveWelcomeStamp(!giveWelcomeStamp)}
                            className={`w-11 h-6 shrink-0 rounded-full flex items-center p-0.5 transition-colors ${giveWelcomeStamp ? 'bg-[#FF1F2D]' : 'bg-gray-300'}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${giveWelcomeStamp ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className="h-px bg-orange-200/60 w-full" />

                    <div className="flex flex-col gap-1 w-full">
                        <h4 className="font-semibold text-gray-900 text-sm mb-1">Caducidad de los sellos</h4>
                        <p className="text-xs text-gray-600 mb-3">Comportamiento en cuentas inactivas.</p>
                        <select
                            value={expiration}
                            onChange={(e) => setExpiration(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-orange-200 bg-white text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#FF1F2D]"
                        >
                            <option>Sin vencimiento</option>
                            <option>Vencen a los 90 días sin visita</option>
                            <option>Vencen a los 180 días sin visita</option>
                        </select>
                    </div>
                </div>
                {/* Info */}
                <p className="text-xs text-gray-400 italic mt-auto pt-2">La personalización gráfica (colores de marca y tipografías oficiales) es gestionada por el equipo de soporte de Mimo para garantizar el estándar de Apple y Google Wallet.</p>
            </div>

            {/* Right Column (5 cols) */}
            <div className="xl:col-span-5 bg-[#f8f9fa] rounded-[32px] p-6 lg:p-10 xl:p-6 border border-gray-100 flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-6">
                    <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-gray-500" />
                        <span className="text-xs font-bold text-gray-500 tracking-wider">VISTA PREVIA DEL PASE</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-full border border-green-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span className="text-[9px] font-bold text-green-700 uppercase tracking-widest hidden sm:inline-block">iOS & Android</span>
                    </div>
                </div>

                <div className="w-full max-w-sm mb-8 flex bg-gray-200/60 p-1.5 rounded-xl">
                    <button onClick={() => setWalletTab('apple')} className={`flex-1 py-1.5 rounded-lg shadow-sm text-xs font-bold transition-colors ${walletTab === 'apple' ? 'bg-white text-gray-900 border border-gray-200/50' : 'text-gray-500 hover:text-gray-700'}`}>Apple Wallet</button>
                    <button onClick={() => setWalletTab('google')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${walletTab === 'google' ? 'bg-white text-gray-900 border border-gray-200/50 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Google Wallet</button>
                </div>

                {walletTab === 'apple' ? (
                    <div className="w-[300px] sm:w-[320px] bg-white rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-200/60 p-6 relative flex flex-col gap-6">
                        {/* Header */}
                        <div className="flex justify-between items-center z-10 w-full relative">
                            <span className="text-xl font-black tracking-tighter text-gray-900">mimo</span>
                            <div className="flex items-center gap-1.5 opacity-60">
                                <Smartphone className="w-3.5 h-3.5 text-gray-800" />
                                <span className="text-[10px] font-black text-gray-800 tracking-wide">APPLE WALLET</span>
                            </div>
                        </div>

                        {/* Brand */}
                        <div className="flex justify-between items-start pt-1">
                            <div className="flex flex-col gap-0.5">
                                <h2 className="text-[22px] font-black text-gray-900 leading-tight tracking-tight">{form.name || "Gran Café"}</h2>
                                <span className="text-[13px] font-bold text-red-600/90 tracking-wide">Tarjeta de sellos</span>
                            </div>
                            <div className="w-[46px] h-[46px] rounded-full bg-red-50 flex items-center justify-center shrink-0">
                                <Coffee className="w-5 h-5 text-red-600 stroke-[2.5]" />
                            </div>
                        </div>

                        {/* Progress */}
                        <div className="flex flex-col gap-4 mt-2">
                            <div className="flex justify-between items-end">
                                <span className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">Tus sellos</span>
                                <span className="text-[22px] font-black text-red-600 leading-none">4 / {localRewardTarget}</span>
                            </div>
                            <div
                                className="grid gap-2.5 my-3 place-items-center w-full mx-auto"
                                style={{ gridTemplateColumns: `repeat(${Math.ceil(localRewardTarget / 2)}, minmax(0, 1fr))` }}
                            >
                                {Array.from({ length: localRewardTarget }).map((_, i) => {
                                    const isFilled = i < 4;
                                    const isLast = i === localRewardTarget - 1;
                                    return (
                                        <div key={i} className={`w-[30px] h-[30px] sm:w-[34px] sm:h-[34px] rounded-full flex items-center justify-center shrink-0 shadow-inner ${isFilled ? '' : 'bg-gray-100 border border-gray-200/80 shadow-[inset_0_1px_3px_rgb(0,0,0,0.1)]'}`} style={isFilled ? { backgroundColor: brandColor } : {}}>
                                            {isFilled ? (
                                                <Check className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white stroke-[3.5]" />
                                            ) : isLast ? (
                                                <span className="text-[11px] sm:text-[13px] font-black leading-none mb-[1px]" style={{ color: brandColor }}>★</span>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Reward */}
                        <div className="rounded-2xl p-4 flex items-start gap-4 mt-2 shadow-sm border border-black/5" style={{ backgroundColor: `${brandColor}10` }}>
                            <div className="bg-white rounded-[10px] p-2.5 shrink-0 border border-black/5 shadow-sm">
                                <Gift className="w-5 h-5" style={{ color: brandColor }} />
                            </div>
                            <div className="flex flex-col h-full pt-0.5 justify-center">
                                <span className="text-[9px] font-black uppercase tracking-widest leading-none mb-1" style={{ color: brandColor }}>Recompensa:</span>
                                <span className="text-[13px] font-bold text-gray-900 mt-1 leading-snug">{localRewardDesc || "Premio final al completar"}</span>
                            </div>
                        </div>

                        {/* Footer mock */}
                        <div className="flex flex-col items-center gap-1.5 opacity-40 mt-4 pt-3 border-t border-dashed border-gray-200">
                            <div className="flex gap-5">
                                <span className="text-[9px] font-bold tracking-wider text-gray-500 uppercase">Compatible iOS</span>
                                <span className="text-[9px] font-bold tracking-wider text-gray-500 uppercase">iOS Push Notifications</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-[300px] sm:w-[320px] bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-gray-200/60 relative flex flex-col overflow-hidden h-[450px]">
                        <div style={{ backgroundColor: brandColor }} className="w-full h-[120px] relative px-6 py-5 shrink-0 flex flex-col justify-between">
                            <div className="flex justify-between items-center text-white/90">
                                <span className="text-[10px] font-black tracking-wide">GOOGLE WALLET</span>
                            </div>
                            <div className="flex gap-4 items-center">
                                {form.logo_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={form.logo_url} alt="Logo" className="w-[50px] h-[50px] rounded-full border-2 border-white/20 bg-white object-cover" />
                                ) : (
                                    <div className="w-[50px] h-[50px] rounded-full border-2 border-white/20 bg-white flex items-center justify-center">
                                        <Store className="w-5 h-5 text-gray-800" />
                                    </div>
                                )}
                                <h2 className="text-xl font-black text-white leading-tight tracking-tight drop-shadow-sm">{form.name || "Gran Café"}</h2>
                            </div>
                        </div>

                        <div className="p-6 flex flex-col flex-1 bg-white relative -mt-3 rounded-t-[20px] z-10 gap-5 items-center text-center pb-8 border-t border-black/5">
                            <span className="text-gray-900 font-bold text-[15px]">Tarjeta de sellos</span>

                            <div className="flex flex-col items-center justify-center bg-gray-50 border border-gray-100 rounded-2xl p-4 w-full">
                                <span className="text-xs text-gray-500 font-bold tracking-wide">PUNTOS</span>
                                <span className="text-3xl font-black mt-1" style={{ color: brandColor }}>4 / {localRewardTarget}</span>
                            </div>

                            <div className="flex flex-col items-center justify-center w-full gap-2 mt-auto">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=example" alt="QR" className="w-[90px] h-[90px] opacity-80 mix-blend-multiply" />
                                <span className="text-[9px] text-gray-400 font-bold tracking-widest uppercase mt-2">Muestra este código</span>
                                <span className="text-xs font-bold text-gray-800 px-2 line-clamp-2 leading-snug mt-1">{localRewardDesc || "Premio final al completar"}</span>
                            </div>
                        </div>
                    </div>
                )}

                <p className="text-[11px] font-bold text-gray-400 mt-8 text-center max-w-[240px] leading-relaxed">
                    Sincronización automática en pases Apple Wallet (.pkpass) y Google Wallet
                </p>
            </div>
        </div>
    );
}
