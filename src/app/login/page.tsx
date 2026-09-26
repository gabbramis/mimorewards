'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
                router.push('/admin/metricas');
                router.refresh();
            }
        } catch (err) {
            setErrorMsg('Error de conexión al iniciar sesión');
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen w-full bg-gradient-to-br from-[#990B13] via-[#C4121D] to-[#590409] flex flex-col justify-between p-6 sm:p-10 text-white selection:bg-[#FF1F2D] selection:text-white">
            {/* Botón superior Volver */}
            <div className="w-full max-w-7xl mx-auto">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide text-white/80 hover:text-white transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al inicio
                </Link>
            </div>

            {/* Tarjeta Central en Contraste Oscuro */}
            <div className="w-full max-w-[420px] mx-auto my-auto">
                <div className="bg-[#0D131F]/95 backdrop-blur-md rounded-[26px] p-8 sm:p-10 shadow-2xl border border-white/10">

                    {/* Logo y Encabezado */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center mb-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/images/mimo-logo.png" alt="Mimo Rewards" className="h-30 w-auto object-contain drop-shadow-md" />
                        </div>
                        <p className="text-xs text-slate-400 font-medium tracking-wide">
                            Panel de Administración
                        </p>
                    </div>

                    {/* Mensaje de Error */}
                    {errorMsg && (
                        <div className="mb-5 p-3.5 bg-red-950/60 border border-red-500/50 rounded-xl flex items-center gap-2.5 text-xs font-medium text-red-200">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Formulario */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-semibold tracking-wide text-slate-300 mb-1.5">
                                Correo Electrónico
                            </label>
                            <input
                                type="email"
                                required
                                autoComplete="off"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="test@comercio.com"
                                className="w-full px-4 py-3 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#FF1F2D] transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold tracking-wide text-slate-300 mb-1.5">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                required
                                autoComplete="off"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#FF1F2D] transition-all"
                            />
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 text-slate-300">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-[#FF1F2D] focus:ring-0 cursor-pointer"
                                />
                                Recordarme
                            </label>
                            <span className="text-slate-400 hover:text-white cursor-pointer transition-colors">
                                ¿Olvidaste tu contraseña?
                            </span>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 py-3 px-6 rounded-xl bg-[#FF1F2D] hover:bg-[#E01825] active:scale-[0.99] text-white font-semibold text-sm transition-all shadow-lg shadow-black/30 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Verificando...
                                </>
                            ) : (
                                'Iniciar Sesión'
                            )}
                        </button>
                    </form>

                    {/* Separador */}
                    <div className="relative my-6 text-center">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-700/80"></div>
                        </div>
                        <span className="relative bg-[#0D131F] px-3 text-[11px] text-slate-500">
                            o
                        </span>
                    </div>

                    {/* Footer de la Tarjeta */}
                    <div className="text-center text-xs text-slate-400">
                        ¿No tienes una cuenta?{' '}
                        <span className="font-semibold text-[#FF1F2D] hover:underline cursor-pointer">
                            Contactar Soporte Mimo
                        </span>
                    </div>
                </div>
            </div>

            {/* Espaciador inferior para centrado óptico perfecto */}
            <div className="h-6"></div>
        </div>
    );
}
