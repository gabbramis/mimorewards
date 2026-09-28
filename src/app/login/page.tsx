'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { ArrowLeft, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        const savedEmail = localStorage.getItem('mimo_saved_email');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
    }, []);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookieOptions: {
                maxAge: 4 * 60 * 60 // 4 horas para caducidad forzada
            }
        }
    );

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password,
            });

            if (error) {
                setErrorMsg('Email o contraseña incorrectos');
                setLoading(false);
                return;
            }

            if (data?.user) {
                if (rememberMe) {
                    localStorage.setItem('mimo_saved_email', email);
                } else {
                    localStorage.removeItem('mimo_saved_email');
                }
                router.push('/admin/metricas');
                router.refresh();
            }
        } catch (err) {
            setErrorMsg('Error de conexión al iniciar sesión');
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen w-full bg-[#FFF6EE] flex flex-col justify-between p-6 sm:p-10 font-sans text-[#1F1F1F] selection:bg-[#FF1F2D] selection:text-white">
            {/* Botón superior Volver */}
            <div className="w-full max-w-7xl mx-auto">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-[#8F8F8F] hover:text-[#1F1F1F] transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al inicio
                </Link>
            </div>

            {/* Tarjeta Central */}
            <div className="w-full max-w-[400px] mx-auto my-auto">
                <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-[#FFD9DC]">

                    {/* Logo y Encabezado */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center mb-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/images/mimo-logo.png" alt="Mimo Rewards" className="h-[4.5rem] w-auto object-contain" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-[#1F1F1F] font-poppins">
                            Iniciar sesión en tu panel
                        </h1>
                    </div>

                    {/* Mensaje de Error */}
                    {errorMsg && (
                        <div className="mb-6 p-3.5 bg-[#FFF6EE] border border-red-300 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-[#FF1F2D]">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Formulario */}
                    <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
                        <div>
                            <label className="block text-xs font-semibold tracking-wide text-[#1F1F1F] mb-1.5 ml-1">
                                Correo Electrónico
                            </label>
                            <input
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="test@comercio.com"
                                className="w-full px-4 py-3.5 rounded-2xl bg-[#F1F1F1] text-[#1F1F1F] placeholder:text-[#8F8F8F] text-sm font-medium border border-[#E5E5E5] focus:outline-none focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D] transition-all shadow-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold tracking-wide text-[#1F1F1F] mb-1.5 ml-1">
                                Contraseña
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-4 pr-11 py-3.5 rounded-2xl bg-[#F1F1F1] text-[#1F1F1F] placeholder:text-[#8F8F8F] text-sm font-medium border border-[#E5E5E5] focus:outline-none focus:bg-white focus:border-[#FF1F2D] focus:ring-1 focus:ring-[#FF1F2D] transition-all shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(prev => !prev)}
                                    className="absolute inset-y-0 right-3 flex items-center justify-center p-1.5 text-[#8F8F8F] hover:text-[#1F1F1F] transition-colors focus:outline-none"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                            <label className="flex items-center gap-2 cursor-pointer select-none py-1 text-[#1F1F1F] font-medium">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded border-zinc-300 text-[#FF1F2D] focus:ring-[#FF1F2D] accent-[#FF1F2D]"
                                />
                                <span className="text-xs text-[#1F1F1F]/70">Recordar mi correo</span>
                            </label>
                            <span className="text-[#8F8F8F] hover:text-[#FF1F2D] font-semibold cursor-pointer transition-colors">
                                ¿Olvidaste tu clave?
                            </span>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-4 py-3.5 px-4 rounded-2xl bg-[#FF1F2D] hover:bg-[#E01825] active:scale-[0.99] text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Ingresando...
                                </>
                            ) : (
                                'Ingresar al comercio'
                            )}
                        </button>
                    </form>
                </div>

                <div className="text-center text-[11px] font-medium text-[#8F8F8F] mt-8">
                    Mimo Rewards · Acceso exclusivo para comercios adheridos
                </div>
            </div>

            {/* Espaciador inferior */}
            <div className="h-6"></div>
        </div>
    );
}
