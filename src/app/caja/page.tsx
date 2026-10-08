"use client";
import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Search, Camera, CreditCard, Send, CheckCircle2, User, Phone, Gift, AlertCircle, CameraOff } from "lucide-react";
import { createClient } from '@/lib/supabase/client';

export default function CashierTerminal() {
    const [scanResult, setScanResult] = useState(null);
    const [manualInput, setManualInput] = useState("");
    const [customer, setCustomer] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [scannerActive, setScannerActive] = useState(false); // Manual entry as default contingency

    const scannerRef = useRef(null);
    const supabase = createClient();

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
            oscillator.frequency.value = 800; // 800 Hz beep
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.2);
        } catch (e) { } // Ignore if AudioContext fails/is blocked
    };

    async function fetchCustomerProfile(identifier, method) {
        setIsLoading(true);
        setErrorMsg("");

        try {
            const cleanQuery = typeof identifier === 'string' ? identifier.trim() : identifier;
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanQuery);
            const orQuery = isUUID
                ? `unique_code.ilike.${cleanQuery},phone.eq.${cleanQuery},id.eq.${cleanQuery}`
                : `unique_code.ilike.${cleanQuery},phone.eq.${cleanQuery}`;

            const { data, error } = await supabase
                .from('customers')
                .select('id, first_name, last_name, phone, current_stamps, unique_code')
                .or(orQuery)
                .maybeSingle();

            if (error) {
                console.error("Error al buscar cliente:", error);
            }

            if (data) {
                playSuccessBeep();
                setCustomer({
                    id: data.id,
                    firstName: data.first_name,
                    lastName: data.last_name,
                    phone: data.phone,
                    currentStamps: data.current_stamps,
                    targetStamps: 10,
                    uniqueCode: data.unique_code
                });
                setManualInput("");
            } else {
                setErrorMsg("Cliente no encontrado o código inválido.");
            }
        } catch (error) {
            console.error(error);
            setErrorMsg("Ocurrió un error inesperado al conectar.");
        } finally {
            setIsLoading(false);
        }
    }

    const extractIdentifier = (text) => {
        // If it's a URL structure or contains the unique code:
        const match = text.match(/CLI-\d+/i);
        if (match) return match[0];
        return text;
    };

    const onScanSuccess = (decodedText) => {
        setScannerActive(false); // Dismiss scanner once detected
        const id = extractIdentifier(decodedText);
        setScanResult(id);
        fetchCustomerProfile(id, 'QR');
    };

    const onScanFailure = () => { };

    useEffect(() => {
        if (scannerActive && !customer && !successMessage) {
            if (!scannerRef.current) {
                scannerRef.current = new Html5QrcodeScanner(
                    "reader",
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    false
                );
                scannerRef.current.render(onScanSuccess, onScanFailure);
            }
        } else {
            if (scannerRef.current) {
                try { scannerRef.current.clear(); } catch (e) { }
                scannerRef.current = null;
            }
        }
        return () => {
            if (scannerRef.current) {
                try { scannerRef.current.clear(); } catch (e) { }
                scannerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customer, successMessage, scannerActive]);

    const handleManualSearch = (e) => {
        e.preventDefault();
        if (!manualInput.trim()) return;
        setScannerActive(false); // Stop scanner if running
        fetchCustomerProfile(manualInput, 'MANUAL');
    };

    const handleAddStamp = async () => {
        setIsLoading(true);
        setErrorMsg("");
        try {
            const res = await fetch('/api/stamps/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: customer.id, method: scanResult ? 'QR' : 'MANUAL' })
            });
            const result = await res.json();

            if (!res.ok) throw new Error(result.error);

            setSuccessMessage("¡Sello agregado con éxito!");
            setCustomer(prev => ({
                ...prev,
                currentStamps: result.newTotal
            }));

            setTimeout(() => {
                setSuccessMessage("");
                setCustomer(null);
                setScanResult(null);
                setScannerActive(false);
            }, 2000);
        } catch (err) {
            setErrorMsg(err.message || 'Error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRedeem = async () => {
        setIsLoading(true);
        setErrorMsg("");
        try {
            const res = await fetch('/api/stamps/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: customer.id })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);

            setSuccessMessage("¡Premio canjeado exitosamente!");
            setCustomer(prev => ({ ...prev, currentStamps: 0 }));

            setTimeout(() => {
                setSuccessMessage("");
                setCustomer(null);
                setScanResult(null);
                setScannerActive(false);
            }, 2000);
        } catch (err) {
            setErrorMsg(err.message || 'Error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto relative shadow-xl overflow-hidden font-sans">
            <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <h1 className="font-bold text-gray-800 text-lg">Caja / Terminal</h1>
                <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                    <CheckCircle2 size={14} />
                    Online
                </div>
            </header>
            <main className="flex-1 p-6 flex flex-col gap-6">

                {errorMsg && !customer && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
                        <AlertCircle size={20} className="text-red-500 shrink-0" />
                        <p className="font-medium text-sm">{errorMsg}</p>
                    </div>
                )}

                {successMessage && (
                    <div className="bg-green-50 text-green-700 px-4 py-5 rounded-2xl flex flex-col items-center justify-center gap-3 animate-pulse border border-green-200 text-center">
                        <CheckCircle2 size={40} className="text-green-500 shrink-0 shadow-sm rounded-full" />
                        <p className="font-bold text-xl">{successMessage}</p>
                    </div>
                )}

                {!customer && !successMessage && (
                    <>
                        <div className="flex bg-gray-200 p-1 rounded-xl shadow-inner">
                            <button
                                onClick={() => setScannerActive(false)}
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${!scannerActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Búsqueda Manual
                            </button>
                            <button
                                onClick={() => setScannerActive(true)}
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${scannerActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Camera size={16} /> Cámara
                            </button>
                        </div>

                        {scannerActive ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col mt-2">
                                <div className="bg-gray-800 text-white p-3 flex items-center justify-center gap-2">
                                    <Camera size={18} />
                                    <span className="font-medium text-sm tracking-wide">ESCANEAR CÓDIGO QR</span>
                                </div>
                                <div id="reader" className="w-full bg-black min-h-[300px] flex items-center justify-center"></div>
                                <button
                                    className="w-full py-4 bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition-colors flex justify-center items-center gap-2"
                                    onClick={() => setScannerActive(false)}
                                >
                                    <CameraOff size={18} /> Apagar Cámara
                                </button>
                            </div>
                        ) : (
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mt-2">
                                <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                                    <Search size={16} /> Buscar Cliente
                                </h2>
                                <form onSubmit={handleManualSearch} className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="CLI-12345 o Teléfono..."
                                        className="flex-1 border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 border outline-none font-medium text-gray-900"
                                        value={manualInput}
                                        onChange={(e) => setManualInput(e.target.value)}
                                        disabled={isLoading}
                                        autoFocus
                                    />
                                    <button
                                        type="submit"
                                        disabled={!manualInput.trim() || isLoading}
                                        className="bg-blue-600 text-white px-5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center shrink-0"
                                    >
                                        <Send size={20} />
                                    </button>
                                </form>
                            </div>
                        )}

                        <div className="text-center text-sm font-medium text-gray-400 flex items-center justify-center gap-2 py-4 mt-auto">
                            <CreditCard size={18} /> Acercar tag NFC al lector para leer pase
                        </div>
                    </>
                )}

                {customer && !successMessage && (
                    <div className="flex flex-col gap-6 flex-1">
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center mt-4">
                            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 shrink-0">
                                <User size={40} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-1">
                                {customer.firstName} {customer.lastName}
                            </h2>
                            <div className="text-gray-500 flex items-center gap-2 mb-2 font-medium">
                                <span className="bg-gray-100 px-3 py-1 rounded-full text-sm text-gray-700">
                                    {customer.uniqueCode}
                                </span>
                            </div>
                            <div className="text-gray-400 flex items-center gap-2 text-sm mt-1">
                                <Phone size={14} />
                                {customer.phone || 'Sin télefono'}
                            </div>

                            <div className="w-full mt-8">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="font-semibold text-gray-700">Sellos Acumulados</span>
                                    <span className="text-xl font-black text-blue-600">{customer.currentStamps} <span className="text-gray-400 text-base font-medium">/ {customer.targetStamps}</span></span>
                                </div>
                                <div className="h-4 bg-gray-100 rounded-full overflow-hidden w-full">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500 ease-out"
                                        style={{ width: `${Math.min(100, (customer.currentStamps / customer.targetStamps) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="text-red-500 text-sm font-medium text-center">{errorMsg}</div>
                        )}

                        <div className="flex flex-col gap-3 mt-auto">
                            <button
                                onClick={handleAddStamp}
                                disabled={isLoading || customer.currentStamps >= customer.targetStamps}
                                className="w-full bg-blue-600 text-white py-5 rounded-2xl font-bold text-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:shadow-none transition-colors shadow-lg shadow-blue-200 flex justify-center items-center gap-2"
                            >
                                +1 Sello a la Tarjeta
                            </button>

                            <button
                                onClick={handleRedeem}
                                disabled={isLoading || customer.currentStamps < customer.targetStamps}
                                className={`w-full py-5 rounded-2xl font-bold text-lg flex justify-center items-center gap-2 transition-colors flex-col
                  ${customer.currentStamps >= customer.targetStamps
                                        ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-200'
                                        : 'bg-gray-100 text-gray-400 hidden'}`}
                            >
                                <div className="flex items-center gap-2"><Gift size={22} /> Canjear Premio</div>
                            </button>

                            <button
                                onClick={() => { setCustomer(null); setErrorMsg(""); setScanResult(null); }}
                                className="w-full py-3 text-gray-500 font-medium hover:text-gray-700"
                            >
                                Cancelar y volver
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
