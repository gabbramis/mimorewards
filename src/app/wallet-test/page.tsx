'use client';

import { useState } from 'react';
import { Wallet, Plus, Loader2 } from 'lucide-react';

export default function WalletTestPage() {
    const [stamps, setStamps] = useState(3);
    const maxStamps = 8;
    const [isGenerating, setIsGenerating] = useState(false);
    const [isStamping, setIsStamping] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleGeneratePass = async () => {
        try {
            setIsGenerating(true);
            setMessage({ type: '', text: '' });

            const response = await fetch('/api/wallet/test-pass');
            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to generate pass');
            }

            window.open(data.saveUrl, '_blank');
            setMessage({ type: 'success', text: 'Pase generado. Revisa la nueva pestaña.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStamping = async () => {
        try {
            if (stamps >= maxStamps) return;

            setIsStamping(true);
            setMessage({ type: '', text: '' });

            const nextStamps = stamps + 1;

            const response = await fetch('/api/wallet/simulate-stamp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardId: 'demo-card-001',
                    currentStamps: nextStamps,
                    maxStamps
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to update pass');
            }

            setStamps(nextStamps);
            setMessage({ type: 'success', text: '¡Sello añadido! Revisa tu Google Wallet, debería actualizarse enseguida.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setIsStamping(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-sm bg-neutral-800 rounded-2xl shadow-xl overflow-hidden border border-neutral-700">
                {/* Header */}
                <div className="bg-emerald-500 p-6 flex flex-col items-center">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-inner mb-4">
                        <span className="text-3xl">☕</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Mimo Café</h1>
                    <p className="text-emerald-100 font-medium mt-1">Franco Echichurre</p>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="flex justify-between items-end mb-2">
                        <h2 className="text-gray-300 font-semibold uppercase tracking-wider text-xs">Sellos Acumulados</h2>
                        <span className="text-xl font-bold text-white">{stamps} / {maxStamps}</span>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-neutral-700 h-3 rounded-full overflow-hidden mb-8">
                        <div
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${(stamps / maxStamps) * 100}%` }}
                        />
                    </div>

                    <div className="space-y-4">
                        <button
                            onClick={handleGeneratePass}
                            disabled={isGenerating}
                            className="w-full bg-neutral-700 hover:bg-neutral-600 text-white rounded-xl py-3 px-4 font-semibold flex items-center justify-center transition-colors disabled:opacity-50"
                        >
                            {isGenerating ? (
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            ) : (
                                <Wallet className="w-5 h-5 mr-2" />
                            )}
                            {isGenerating ? 'Generando...' : 'Abrir en Google Wallet'}
                        </button>

                        <button
                            onClick={handleStamping}
                            disabled={isStamping || stamps >= maxStamps}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl py-3 px-4 font-semibold flex items-center justify-center transition-colors shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:shadow-none"
                        >
                            {isStamping ? (
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                            ) : (
                                <Plus className="w-5 h-5 mr-2 stroke-[3]" />
                            )}
                            {stamps >= maxStamps ? 'Tarjeta Llena' : '+1 Sello en vivo'}
                        </button>
                    </div>

                    {message.text && (
                        <div className={`mt-6 p-4 rounded-xl text-sm font-medium ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                            {message.text}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
