"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import { Search, CreditCard, Send, CheckCircle2, User, Phone, Gift, AlertCircle, QrCode, X, ArrowLeft } from "lucide-react";
import { createClient } from '@/lib/supabase/client';
import { getUruguayMobileVariants, normalizeCustomerPhone, normalizeUruguayMobile } from '@/lib/customer-phone';

export default function CashierTerminal() {
    const router = useRouter();
    const [manualInput, setManualInput] = useState("");
    const [customer, setCustomer] = useState<{
        id: string;
        firstName: string;
        lastName: string;
        phone: string;
        currentStamps: number;
        targetStamps: number;
        uniqueCode: string;
    } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [isQrModalOpen, setIsQrModalOpen] = useState(false);
    const [qrToken, setQrToken] = useState<number>(0);
    const [businessSlug, setBusinessSlug] = useState<string>("");
    const [businessId, setBusinessId] = useState<string>("");
    const [origin, setOrigin] = useState<string>("");

    const supabase = createClient();

    useEffect(() => {
        async function fetchBusinessSlug() {
            try {
                if (typeof window !== "undefined") {
                    const urlParams = new URLSearchParams(window.location.search);
                    const qBizId = urlParams.get("businessId");
                    if (qBizId) {
                        const { data: b } = await supabase
                            .from("businesses")
                            .select("id, slug")
                            .eq("id", qBizId)
                            .maybeSingle();
                        if (b) {
                            setBusinessId(b.id);
                            if (b.slug) setBusinessSlug(b.slug);
                            return;
                        }
                    }
                }

                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: member } = await supabase
                        .from("business_members")
                        .select("business_id, businesses(id, slug)")
                        .eq("user_id", user.id)
                        .order("created_at", { ascending: true })
                        .limit(1)
                        .maybeSingle();

                    if (member?.business_id) {
                        setBusinessId(member.business_id);
                    }
                    if ((member as any)?.businesses?.slug) {
                        setBusinessSlug((member as any).businesses.slug);
                        return;
                    }
                    if (member?.business_id) {
                        const { data: b } = await supabase
                            .from("businesses")
                            .select("id, slug")
                            .eq("id", member.business_id)
                            .maybeSingle();
                        if (b?.slug) {
                            setBusinessSlug(b.slug);
                            if (b.id) setBusinessId(b.id);
                            return;
                        }
                    }
                }

                const { data: firstBiz } = await supabase
                    .from("businesses")
                    .select("id, slug")
                    .limit(1)
                    .maybeSingle();
                if (firstBiz?.slug) {
                    setBusinessSlug(firstBiz.slug);
                    if (firstBiz.id) setBusinessId(firstBiz.id);
                }
            } catch (err) {
                console.error("Error al obtener datos del negocio:", err);
            }
        }

        fetchBusinessSlug();
    }, [supabase]);

    // Rotación del QR cada 5 minutos mientras el modal esté abierto
    useEffect(() => {
        if (!isQrModalOpen) return;

        const intervalId = setInterval(() => {
            setQrToken(Date.now());
        }, 300000);

        return () => {
            clearInterval(intervalId);
        };
    }, [isQrModalOpen]);

    const playSuccessBeep = () => {
        try {
            const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextConstructor) return;
            const audioCtx = new AudioContextConstructor();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sine';
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.2);
        } catch (e) { }
    };

    async function fetchCustomerProfile(identifier: string) {
        setIsLoading(true);
        setErrorMsg("");

        try {
            const cleanQuery = typeof identifier === 'string' ? identifier.trim() : identifier;
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanQuery);
            const variants = getUruguayMobileVariants(cleanQuery);

            let orQuery = isUUID
                ? `unique_code.ilike.${cleanQuery},phone.eq.${cleanQuery},id.eq.${cleanQuery}`
                : `unique_code.ilike.${cleanQuery},phone.eq.${cleanQuery}`;

            for (const v of variants) {
                if (v !== cleanQuery) {
                    orQuery += `,phone.eq.${v}`;
                }
            }

            let query = supabase
                .from('customers')
                .select('id, first_name, last_name, phone, current_stamps, unique_code, business_id');

            if (businessId) {
                query = query.eq('business_id', businessId);
            }

            const { data, error } = await query.or(orQuery).maybeSingle();

            if (error) throw error;

            if (data) {
                const { data: business, error: businessError } = await supabase
                    .from('businesses')
                    .select('reward_target')
                    .eq('id', data.business_id)
                    .maybeSingle();
                if (businessError) throw businessError;
                playSuccessBeep();
                setCustomer({
                    id: data.id,
                    firstName: data.first_name,
                    lastName: data.last_name,
                    phone: data.phone,
                    currentStamps: data.current_stamps,
                    targetStamps: business?.reward_target || 10,
                    uniqueCode: data.unique_code
                });
                setManualInput("");
            } else {
                setErrorMsg("Cliente no encontrado o código inválido.");
            }
        } catch (error) {
            setErrorMsg(error instanceof Error ? error.message : "Ocurrió un error inesperado al conectar.");
        } finally {
            setIsLoading(false);
        }
    }

    const handleManualSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualInput.trim()) return;
        fetchCustomerProfile(manualInput);
    };

    const handleAddStamp = async () => {
        if (!customer) return;
        setIsLoading(true);
        setErrorMsg("");
        try {
            const res = await fetch('/api/stamps/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: customer.id, businessId, method: 'MANUAL' })
            });
            const result = await res.json();

            if (!res.ok) throw new Error(result.error);

            setSuccessMessage(result.cycleCompleted ? "¡Tarjeta completada! Comenzó un nuevo ciclo con 1 sello." : (result.message || "¡Sello agregado con éxito!"));
            setCustomer(prev => prev ? ({
                ...prev,
                currentStamps: result.newTotal
            }) : null);

            setTimeout(() => {
                setSuccessMessage("");
                setCustomer(null);
            }, 2000);
        } catch (err: any) {
            setErrorMsg(err.message || 'Error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRedeem = async () => {
        if (!customer) return;
        setIsLoading(true);
        setErrorMsg("");
        try {
            const res = await fetch('/api/stamps/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: customer.id, businessId })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            setSuccessMessage("¡Premio canjeado exitosamente!");
            setCustomer(prev => prev ? ({ ...prev, currentStamps: 0 }) : null);

            setTimeout(() => {
                setSuccessMessage("");
                setCustomer(null);
            }, 2000);
        } catch (err: any) {
            setErrorMsg(err.message || 'Error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100/80 sm:py-6 sm:px-4 flex flex-col items-center justify-start font-sans selection:bg-[#FF1F2D] selection:text-white">
            <div className="w-full max-w-lg min-h-screen sm:min-h-0 bg-slate-50 sm:rounded-3xl shadow-xl sm:shadow-2xl border border-slate-200/70 flex flex-col overflow-hidden relative">
                {/* Header */}
                <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-xs">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => router.push('/admin/crm')}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors py-1.5 px-2.5 rounded-xl border border-slate-200/80 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                            title="Volver al Panel"
                        >
                            <ArrowLeft size={15} />
                            <span className="hidden sm:inline">Volver al Panel</span>
                            <span className="sm:hidden">Volver</span>
                        </button>
                        <div className="w-8 h-8 rounded-xl bg-red-50 text-[#FF1F2D] flex items-center justify-center font-black text-sm shadow-xs border border-red-100/80">
                            M
                        </div>
                        <div>
                            <h1 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight leading-tight">
                                Caja / Terminal
                            </h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-700 tracking-wider uppercase">
                                    Online
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setOrigin(window.location.origin);
                            setQrToken(Date.now());
                            setIsQrModalOpen(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200 hover:border-red-200 hover:bg-red-50/50 px-3 py-2 text-xs font-bold text-slate-800 hover:text-[#FF1F2D] transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
                    >
                        <QrCode size={15} className="text-[#FF1F2D]" />
                        <span className="hidden sm:inline">Ver QR Cliente</span>
                        <span className="sm:hidden">QR Cliente</span>
                    </button>
                </header>

                {/* Contenido Principal */}
                <main className="flex-1 p-5 sm:p-6 flex flex-col gap-5">
                    {/* Feedback: Error */}
                    {errorMsg && !customer && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3.5 rounded-2xl flex items-center gap-3 shadow-xs animate-in fade-in">
                            <AlertCircle size={20} className="text-red-500 shrink-0" />
                            <p className="font-semibold text-xs sm:text-sm">{errorMsg}</p>
                        </div>
                    )}

                    {/* Feedback: Éxito */}
                    {successMessage && (
                        <div className="bg-emerald-50 text-emerald-800 px-5 py-6 rounded-3xl flex flex-col items-center justify-center gap-2.5 border-2 border-emerald-200/80 shadow-md text-center animate-in zoom-in-95">
                            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
                                <CheckCircle2 size={34} />
                            </div>
                            <p className="font-black text-xl sm:text-2xl text-emerald-900">{successMessage}</p>
                        </div>
                    )}

                    {!customer && !successMessage && (
                        <>
                            {/* Buscador Manual Hero */}
                            <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200/80 mt-1 flex flex-col gap-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                            <Search size={14} className="text-slate-400" /> Identificar Cliente
                                        </span>
                                        <span className="text-[11px] font-semibold text-slate-400">Paso 1 de 2</span>
                                    </div>
                                    <p className="text-sm text-slate-600">
                                        Ingresá el código o teléfono para cargar la tarjeta al instante.
                                    </p>
                                </div>

                                <form onSubmit={handleManualSearch} className="flex flex-col sm:flex-row gap-3">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            placeholder="Ej: CLI-12345 o Teléfono..."
                                            className="w-full h-14 sm:h-16 pl-4 pr-11 sm:pr-4 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:border-[#FF1F2D] focus:bg-white text-slate-900 text-base sm:text-lg font-bold placeholder:text-slate-400 placeholder:font-normal outline-none transition-all shadow-inner"
                                            value={manualInput}
                                            onChange={(e) => setManualInput(e.target.value)}
                                            disabled={isLoading}
                                            autoFocus
                                        />
                                        {manualInput && (
                                            <button
                                                type="button"
                                                onClick={() => setManualInput('')}
                                                className="sm:hidden absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={!manualInput.trim() || isLoading}
                                        className="h-14 sm:h-16 px-7 rounded-2xl bg-[#FF1F2D] hover:bg-[#e01825] active:scale-95 text-white font-bold text-base shadow-md shadow-red-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                                    >
                                        <Send size={18} />
                                        <span>Buscar</span>
                                    </button>
                                </form>

                                <div className="flex items-center gap-2 pt-1 text-xs text-slate-400">
                                    <span>💡</span>
                                    <span>Admite código CLI, teléfono o UUID escaneado.</span>
                                </div>
                            </div>

                            {/* Indicador de lectura NFC al pie */}
                            <div className="mt-auto pt-6 pb-2 text-center">
                                <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs text-slate-500 text-xs font-semibold">
                                    <CreditCard size={16} className="text-[#FF1F2D] animate-pulse" />
                                    <span>Acercar tag NFC al lector para leer pase</span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Ficha del Cliente Activo */}
                    {customer && !successMessage && (
                        <div className="flex flex-col gap-6 flex-1">
                            <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xl shadow-slate-200/50 border border-slate-200/80 flex flex-col items-center text-center mt-2">
                                <div className="w-20 h-20 bg-gradient-to-br from-red-50 to-red-100 text-[#FF1F2D] rounded-3xl flex items-center justify-center mb-4 shrink-0 shadow-sm border border-red-200/60">
                                    <User size={38} />
                                </div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
                                    {customer.firstName} {customer.lastName}
                                </h2>
                                <div className="flex items-center gap-2 mb-2 font-mono">
                                    <span className="bg-slate-100 text-slate-700 border border-slate-200/80 px-3 py-1 rounded-full text-xs font-bold tracking-wider">
                                        {customer.uniqueCode}
                                    </span>
                                </div>
                                <div className="text-slate-400 flex items-center gap-1.5 text-xs mt-0.5 font-medium">
                                    <Phone size={13} />
                                    <span>{customer.phone || 'Sin teléfono registrado'}</span>
                                </div>

                                <div className="w-full mt-7 p-4 bg-slate-50 rounded-2xl border border-slate-200/70">
                                    <div className="flex justify-between items-baseline mb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Sellos Acumulados</span>
                                        <span className="text-2xl font-black text-[#FF1F2D]">
                                            {customer.currentStamps}
                                            <span className="text-slate-400 text-sm font-semibold ml-1">/ {customer.targetStamps}</span>
                                        </span>
                                    </div>
                                    <div className="h-3.5 bg-slate-200 rounded-full overflow-hidden w-full p-0.5">
                                        <div
                                            className="h-full bg-gradient-to-r from-red-500 to-[#FF1F2D] rounded-full transition-all duration-500 ease-out"
                                            style={{ width: `${Math.min(100, (customer.currentStamps / customer.targetStamps) * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {errorMsg && (
                                <div className="text-red-500 text-xs font-semibold text-center bg-red-50 border border-red-200 p-3 rounded-xl">{errorMsg}</div>
                            )}

                            {/* Botonera de Acciones POS */}
                            <div className="flex flex-col gap-3 mt-auto pt-2">
                                <button
                                    type="button"
                                    onClick={handleAddStamp}
                                    disabled={isLoading}
                                    className="w-full h-15 sm:h-16 bg-[#FF1F2D] hover:bg-[#e01825] active:scale-[0.99] text-white rounded-2xl font-black text-base sm:text-lg shadow-lg shadow-red-200 disabled:opacity-40 disabled:shadow-none transition-all flex justify-center items-center gap-2 cursor-pointer"
                                >
                                    <span>
                                        {customer.currentStamps >= customer.targetStamps
                                            ? "Comenzar nuevo ciclo (+1 Sello)"
                                            : "+1 Sello a la Tarjeta"}
                                    </span>
                                </button>

                                {customer.currentStamps >= customer.targetStamps && (
                                    <button
                                        type="button"
                                        onClick={handleRedeem}
                                        disabled={isLoading}
                                        className="w-full h-15 sm:h-16 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white rounded-2xl font-black text-base sm:text-lg shadow-lg shadow-amber-200 transition-all flex justify-center items-center gap-2 cursor-pointer"
                                    >
                                        <Gift size={22} />
                                        <span>Canjear Premio</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => { setCustomer(null); setErrorMsg(""); }}
                                    className="w-full py-3 text-slate-500 font-bold text-xs uppercase tracking-wider hover:text-slate-800 transition-colors cursor-pointer"
                                >
                                    Cancelar y volver
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Modal "Ver QR Cliente" con fondo difuminado y QR rotativo */}
            {isQrModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsQrModalOpen(false);
                    }}
                >
                    <div className="relative bg-white p-7 sm:p-9 rounded-3xl shadow-2xl border border-slate-100 flex flex-col items-center max-w-sm w-full mx-4">
                        <button
                            type="button"
                            onClick={() => setIsQrModalOpen(false)}
                            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                            aria-label="Cerrar modal"
                        >
                            <X size={18} />
                        </button>

                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-[#FF1F2D] text-[11px] font-bold tracking-wider uppercase mb-2">
                            <QrCode size={13} />
                            <span>Código QR Dinámico</span>
                        </div>

                        <h3 className="text-xl font-black text-slate-900 tracking-tight text-center">
                            Escanear con Celular
                        </h3>
                        <p className="text-xs text-slate-500 text-center mt-1 mb-5">
                            Mostrá este código al cliente para registrarse o sumar su visita
                        </p>

                        <div className="bg-white p-5 rounded-2xl border-2 border-slate-100 shadow-md flex items-center justify-center transition-transform hover:scale-[1.01]">
                            <QRCode
                                value={`${origin || (typeof window !== "undefined" ? window.location.origin : "https://mimorewards.com")}/t/${businessSlug || "demo"}?t=${qrToken}`}
                                size={220}
                                level="M"
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                viewBox="0 0 256 256"
                            />
                        </div>

                        <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Rotación de seguridad cada 5 min</span>
                        </div>

                        <p className="mt-4 text-center text-xs text-slate-600 font-medium max-w-xs leading-relaxed">
                            Escaneá este código para registrarte o sumar tu sello. (Se actualiza por seguridad)
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
