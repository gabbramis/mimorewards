'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { ArrowLeft, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { getPanelRedirect } from '@/lib/login-access';

function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginForm() {
    const searchParams = useSearchParams();

    const nextParam = searchParams ? (searchParams.get('next') || searchParams.get('redirectTo')) : null;
    const authErrorParam = searchParams ? searchParams.get('error') : null;

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Inicializar cliente Supabase de forma segura con useMemo
    const supabase = useMemo(() => {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) {
            console.error('Supabase: NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no están configuradas.');
            return null;
        }
        try {
            return createBrowserClient(url, key);
        } catch (err) {
            console.error('Error al instanciar createBrowserClient:', err);
            return null;
        }
    }, []);

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            try {
                const savedEmail = localStorage.getItem('mimo_saved_email');
                if (savedEmail) {
                    setEmail(savedEmail);
                    setRememberMe(true);
                }
            } catch {
                // Ignorar errores si el navegador bloquea el almacenamiento.
            }
        });
        return () => window.cancelAnimationFrame(frame);
    }, []);

    const errorMessage = errorMsg || (!loading && !googleLoading && authErrorParam
            ? (authErrorParam === 'unregistered'
                ? 'Tu cuenta todavía no tiene acceso. Completá la solicitud para que podamos asociarla a tu comercio.'
                : authErrorParam === 'inactive'
                    ? 'Tu comercio está inactivo o ya no está disponible. Contactá al administrador para recuperar el acceso.'
                : authErrorParam === 'access_error'
                    ? 'No pudimos consultar tus permisos. Intentá nuevamente en unos minutos.'
                    : 'No se pudo completar el inicio de sesión. Intentá nuevamente.')
            : null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null);

        if (!supabase) {
            setErrorMsg('Error de conexión con el servicio de autenticación.');
            setLoading(false);
            return;
        }

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
                try {
                    if (rememberMe) {
                        localStorage.setItem('mimo_saved_email', email.trim());
                    } else {
                        localStorage.removeItem('mimo_saved_email');
                    }
                } catch {
                    // Ignorar fallos de localStorage
                }

                const destination = new URL('/auth/complete', window.location.origin);
                const next = getPanelRedirect(nextParam);
                if (next) destination.searchParams.set('next', next);
                window.location.assign(destination.toString());
            }
        } catch (err) {
            console.error('Error inesperado durante el login:', err);
            setErrorMsg('Error de conexión al iniciar sesión');
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setGoogleLoading(true);
        setErrorMsg(null);
        if (!supabase) {
            setErrorMsg('Error de conexión con el servicio de autenticación.');
            setGoogleLoading(false);
            return;
        }
        try {
            const callback = new URL('/auth/callback', window.location.origin);
            const next = getPanelRedirect(nextParam);
            if (next) callback.searchParams.set('next', next);
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: callback.toString(), queryParams: { prompt: 'select_account' } },
            });
            if (error) throw error;
        } catch {
            setErrorMsg('No se pudo iniciar el acceso con Google. Intentá de nuevo.');
            setGoogleLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 h-[100dvh] w-[100vw] overflow-y-auto overscroll-none touch-pan-y bg-[#FFF6EE] flex flex-col justify-between p-6 sm:p-10 font-sans text-[#1F1F1F] selection:bg-[#FF1F2D] selection:text-white">
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
                    {errorMessage && (
                        <div role="alert" className="mb-6 p-3.5 bg-[#FFF6EE] border border-red-300 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-[#FF1F2D]">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}
                    {authErrorParam === 'unregistered' && (
                        <Link href="/#acceso" className="mb-5 block text-center text-sm font-semibold text-[#FF1F2D] underline">
                            Solicitar acceso
                        </Link>
                    )}

                    {/* Formulario */}
                    <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
                        <div>
                            <label htmlFor="email" className="block text-xs font-semibold tracking-wide text-[#1F1F1F] mb-1.5 ml-1">
                                Correo Electrónico
                            </label>
                            <input
                                id="email"
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
                            <label htmlFor="password" className="block text-xs font-semibold tracking-wide text-[#1F1F1F] mb-1.5 ml-1">
                                Contraseña
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
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
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
                        </div>

                        <button
                            type="submit"
                            disabled={loading || googleLoading}
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
                    <div className="my-5 flex items-center gap-3 text-xs text-[#8F8F8F]">
                        <span className="h-px flex-1 bg-[#E5E5E5]" />o<span className="h-px flex-1 bg-[#E5E5E5]" />
                    </div>
                    <button type="button" onClick={handleGoogleLogin} disabled={loading || googleLoading}
                        className="w-full py-3.5 px-4 rounded-2xl border-2 border-[#E5E0D8] text-sm font-bold flex items-center justify-center gap-3 hover:bg-[#FFF9F5] disabled:opacity-60 cursor-pointer">
                        {googleLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
                        {googleLoading ? 'Conectando con Google…' : 'Continuar con Google'}
                    </button>
                    <p className="mt-4 text-center text-xs leading-relaxed text-[#737373]">
                        ¿Tu comercio todavía no tiene acceso? <Link href="/#acceso" className="font-semibold text-[#FF1F2D] underline">Dejanos tus datos</Link> y te ayudamos a empezar.
                    </p>
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
