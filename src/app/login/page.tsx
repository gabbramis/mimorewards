"use client";

import { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";

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

export function LoginContent() {
  const searchParams = useSearchParams();
  const authErrorParam = searchParams ? searchParams.get("error") : null;

  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    try {
      return createBrowserClient(url, key);
    } catch {
      return null;
    }
  }, []);

  const errorMessage = useMemo(() => {
    if (localError) return localError;
    if (authErrorParam === "unregistered") {
      return "Comercio no encontrado. Tu cuenta de Google no está vinculada a ningún comercio activo en Mimo Rewards.";
    }
    if (authErrorParam) {
      return "Hubo un inconveniente al iniciar sesión con Google. Por favor intentá nuevamente.";
    }
    return null;
  }, [localError, authErrorParam]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setLocalError(null);

    if (!supabase) {
      setLocalError("Error de conexión con el servicio de autenticación.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setLocalError("No se pudo iniciar el acceso con Google. Intentá de nuevo.");
        setLoading(false);
      }
    } catch {
      setLocalError("Error de conexión al iniciar sesión con Google.");
      setLoading(false);
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
              <img
                src="/images/mimo-logo.png"
                alt="Mimo Rewards"
                className="h-[4.5rem] w-auto object-contain"
              />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#1F1F1F] font-poppins">
              Iniciar sesión en tu panel
            </h1>
            <p className="mt-2 text-xs font-medium text-[#737373] leading-relaxed">
              Accedé con la cuenta de Google vinculada a tu comercio para gestionar sellos, clientes y recompensas.
            </p>
          </div>

          {/* Mensaje de Error */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-6 p-3.5 bg-[#FFF6EE] border border-red-300 rounded-xl flex items-start gap-2.5 text-xs font-semibold text-[#FF1F2D]"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Botón único de Google OAuth */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-[#FFF9F5] active:scale-[0.99] text-[#1F1F1F] font-bold text-sm border-2 border-[#E5E0D8] hover:border-[#FF1F2D]/40 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-[#FF1F2D]" />
                <span>Conectando con Google…</span>
              </>
            ) : (
              <>
                <GoogleIcon className="w-5 h-5 shrink-0" />
                <span>Continuar con Google</span>
              </>
            )}
          </button>
        </div>

        <div className="text-center text-[11px] font-medium text-[#8F8F8F] mt-8">
          Mimo Rewards · Acceso exclusivo para comercios adheridos
        </div>
      </div>

      {/* Espaciador inferior */}
      <div className="h-6" />
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="min-h-screen w-full bg-[#FFF6EE] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#FF1F2D]" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
