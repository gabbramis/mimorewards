"use client";

import { useEffect, useRef, useState, useTransition, type DragEvent } from "react";
import {
  Building2,
  Camera,
  Gift,
  KeyRound,
  Loader2,
  Mail,
  Rocket,
  Store,
  Trash2,
  Stamp,
  CheckCircle2,
  X,
} from "lucide-react";
import { registerNewBusiness, type RegisterBusinessResult } from "@/app/actions/business";
import { BusinessDesign, emptyDesign, type DesignValue } from "@/components/admin/BusinessDesign";
import { ALLOWED_REWARD_TARGETS, sanitizeWalletConfig, type WalletConfig, isHttpsUrl } from "@/lib/wallet-config";

const MAX_LOGO_BYTES = 800 * 1024;

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-[#FF1F2D] focus:ring-2 focus:ring-red-100 disabled:opacity-60";
const labelClass = "mb-1.5 block text-sm font-semibold text-gray-700";

export default function CrearComercioForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<RegisterBusinessResult | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [stamps, setStamps] = useState<number>(10);
  const [active, setActive] = useState(true);
  const [design, setDesign] = useState<DesignValue>(emptyDesign);
  const [wallet, setWallet] = useState<WalletConfig>(() => sanitizeWalletConfig(null));
  const [rewardDescription, setRewardDescription] = useState("");
  const [businessName, setBusinessName] = useState("");

  const [successToast, setSuccessToast] = useState<{
    visible: boolean;
    message: string;
    description?: string;
  }>({ visible: false, message: "" });

  useEffect(() => {
    if (!successToast.visible) return;
    const timer = setTimeout(() => {
      setSuccessToast((prev) => ({ ...prev, visible: false }));
    }, 8000);
    return () => clearTimeout(timer);
  }, [successToast.visible]);

  function selectLogo(file: File | undefined) {
    setLogoError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("El logo no puede pesar más de 800 KB.");
      return;
    }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function removeLogo() {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    setLogoError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    selectLogo(e.dataTransfer.files?.[0]);
  }

  function handleSubmit(formData: FormData) {
    setResult(null);

    // Validación de URLs de Wallet si se ingresaron
    if (
      (wallet.logoUrl && !isHttpsUrl(wallet.logoUrl)) ||
      (wallet.bannerEnabled && wallet.bannerUrl && !isHttpsUrl(wallet.bannerUrl))
    ) {
      setResult({
        success: false,
        error: "Las URLs del logo y del banner de Wallet deben ser públicas y empezar con https://.",
      });
      return;
    }

    formData.delete("logo");
    if (logoFile) formData.set("logo", logoFile);
    formData.set("rewardTarget", String(stamps));
    formData.set("active", String(active));
    formData.set("primaryColor", design.primaryColor);
    formData.set("cardTextColor", design.textColor);
    formData.set("cardAccentColor", design.accentColor);
    formData.set("stampBackgroundColor", design.stampBackgroundColor);
    formData.set("registroSubtitulo", design.registroSubtitulo);
    formData.set("registroTitulo", design.registroTitulo);
    formData.set("stampSource", design.source || "");
    formData.set("stampCatalogId", design.catalogId || "");
    formData.set("stampEffect", JSON.stringify(design.effect));
    if (design.customFile) formData.set("stampFile", design.customFile);
    formData.set("walletConfig", JSON.stringify({ ...wallet, stampBackgroundColor: design.stampBackgroundColor }));

    startTransition(async () => {
      try {
        const res = await registerNewBusiness(formData);
        setResult(res);
        if (res.success) {
          formRef.current?.reset();
          removeLogo();
          setStamps(10);
          setActive(true);
          setDesign(emptyDesign);
          setWallet(sanitizeWalletConfig(null));
          setRewardDescription("");
          setBusinessName("");
          setSuccessToast({
            visible: true,
            message: "¡Comercio creado con éxito!",
            description: "El dueño ya puede iniciar sesión con sus credenciales.",
          });
        }
      } catch {
        setResult({ success: false, error: "Ocurrió un error inesperado. Intentá de nuevo." });
      }
    });
  }

  return (
    <>
      {/* Toast Flotante de Éxito (Duración exacta: 8 segundos) */}
      {successToast.visible && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3.5 rounded-2xl border border-emerald-200 bg-white/95 px-5 py-4 shadow-2xl backdrop-blur-md ring-1 ring-emerald-500/10 animate-in fade-in slide-in-from-top-4 duration-300 max-w-md w-[calc(100%-2rem)] sm:w-auto"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={20} strokeWidth={2.2} />
          </div>
          <div className="flex-1 pr-2">
            <p className="text-sm font-bold text-gray-900 leading-tight">
              {successToast.message}
            </p>
            {successToast.description && (
              <p className="mt-0.5 text-xs text-gray-500 leading-snug">
                {successToast.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast((prev) => ({ ...prev, visible: false }))}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            aria-label="Cerrar notificación"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <form ref={formRef} action={handleSubmit} className="space-y-8">
        {/* Tarjeta superior: Datos del negocio y Programa de fidelización en 2 columnas */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-6 lg:gap-8 lg:grid-cols-2">
            {/* Columna Izquierda: Datos del negocio y acceso */}
            <div>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#FF1F2D]">
                  <Store size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Datos del negocio</h2>
                  <p className="text-xs text-gray-500">Identidad del comercio y acceso del dueño.</p>
                </div>
              </div>

              <div className="flex flex-col gap-6 sm:flex-row">
                {/* Logo y Compresor */}
                <div className="sm:w-40 sm:shrink-0">
                  <span className={labelClass}>Logo</span>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Subir logo del comercio"
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onDrop}
                    className={`group relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed text-center transition ${
                      isDragging
                        ? "border-[#FF1F2D] bg-red-50"
                        : "border-gray-300 bg-gray-50 hover:border-[#FF1F2D] hover:bg-red-50/50"
                    }`}
                  >
                    {logoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreview} alt="Vista previa del logo" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 px-3 text-gray-500 group-hover:text-[#FF1F2D]">
                        <Camera size={26} strokeWidth={1.6} />
                        <span className="text-xs font-semibold">Subir logo</span>
                        <span className="text-[11px] text-gray-400">máx. 800 KB</span>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => selectLogo(e.target.files?.[0])}
                  />

                  {logoFile && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#FF1F2D]"
                    >
                      <Trash2 size={13} /> Quitar logo
                    </button>
                  )}

                  {logoError && <p className="mt-2 text-xs font-semibold text-red-600">{logoError}</p>}

                  <p className="mt-2 text-[11px] leading-snug text-gray-500">
                    ¿Pesa más de 2MB?{" "}
                    <a
                      href="https://www.iloveimg.com/es/comprimir-imagen"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[#FF1F2D] underline underline-offset-2 hover:text-[#e01826]"
                    >
                      Comprimila gratis
                    </a>
                  </p>
                </div>

                {/* Campos */}
                <div className="flex-1 space-y-4">
                  <div>
                    <label htmlFor="businessName" className={labelClass}>Nombre del comercio</label>
                    <div className="relative">
                      <Building2 size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        id="businessName"
                        name="businessName"
                        type="text"
                        required
                        value={businessName}
                        onChange={(event) => setBusinessName(event.target.value)}
                        disabled={isPending}
                        className={inputClass}
                        placeholder="Ej: Café Central"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className={labelClass}>Correo electrónico del dueño</label>
                    <div className="relative">
                      <Mail size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        disabled={isPending}
                        className={inputClass}
                        placeholder="dueno@comercio.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className={labelClass}>Contraseña de acceso</label>
                    <div className="relative">
                      <KeyRound size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        id="password"
                        name="password"
                        type="password"
                        required
                        minLength={6}
                        disabled={isPending}
                        className={inputClass}
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado del comercio */}
              <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div>
                  <p id="estado-label" className="text-xs font-semibold text-gray-900">Estado del comercio</p>
                  <p className="text-[11px] text-gray-500">
                    {active ? "Activo: los clientes pueden sumar sellos." : "Inactivo: comercio pausado."}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-bold ${active ? "text-[#FF1F2D]" : "text-gray-400"}`}>
                    {active ? "Activo" : "Inactivo"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={active}
                    aria-labelledby="estado-label"
                    disabled={isPending}
                    onClick={() => setActive((value) => !value)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1F2D] disabled:opacity-60 ${
                      active ? "bg-[#FF1F2D]" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                        active ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Programa de fidelización */}
            <div className="lg:border-l lg:border-gray-200 lg:pl-8 flex flex-col justify-between">
              <div>
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#FF1F2D]">
                    <Stamp size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Programa de fidelización</h2>
                    <p className="text-xs text-gray-500">Definí las reglas básicas del beneficio.</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <span id="rewardTarget-label" className={labelClass}>Meta de sellos</span>
                    <div
                      role="radiogroup"
                      aria-labelledby="rewardTarget-label"
                      className="inline-flex flex-wrap gap-2"
                    >
                      {ALLOWED_REWARD_TARGETS.map((option) => {
                        const selected = stamps === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={isPending}
                            onClick={() => setStamps(option)}
                            className={`flex h-11 min-w-[3.25rem] items-center justify-center rounded-xl border px-3.5 text-sm font-bold transition ${
                              selected
                                ? "border-[#FF1F2D] bg-[#FF1F2D] text-white shadow-sm ring-2 ring-red-100"
                                : "border-gray-200 bg-white text-gray-700 hover:border-[#FF1F2D] hover:text-[#FF1F2D]"
                            } disabled:opacity-40`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">Cantidad de sellos requeridos para desbloquear el premio (4, 5, 6, 8 o 10).</p>
                  </div>

                  <div>
                    <label htmlFor="rewardDescription" className={labelClass}>Descripción del premio</label>
                    <div className="relative">
                      <Gift size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        id="rewardDescription"
                        name="rewardDescription"
                        type="text"
                        value={rewardDescription}
                        onChange={(e) => setRewardDescription(e.target.value)}
                        disabled={isPending}
                        className={inputClass}
                        placeholder='Ej: "Un café gratis"'
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">Si lo dejás vacío se usará &ldquo;Un beneficio gratis&rdquo;.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-amber-200/60 bg-amber-50/60 p-3.5 text-xs text-amber-800">
                💡 <span className="font-semibold">Recomendación:</span> Podés previsualizar la tarjeta en vivo abajo con esta meta y premio en tiempo real.
              </div>
            </div>
          </div>
        </section>

        {/* Componente completo de personalización de la tarjeta (Paridad UI con Edición) */}
        <BusinessDesign
          value={design}
          onChange={setDesign}
          logoPreview={logoPreview}
          businessName={businessName}
          rewardTarget={stamps}
          rewardDescription={rewardDescription}
          wallet={wallet}
          onWalletChange={setWallet}
          walletUploadUrl="/api/admin/wallet-image"
          disabled={isPending}
        />

        {result && !result.success && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
            ❌ {result.error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#FF1F2D] px-6 py-4 text-base font-bold text-white shadow-lg shadow-red-200 transition hover:bg-[#e01826] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? <Loader2 size={20} className="animate-spin" /> : <Rocket size={20} />}
          {isPending ? "Creando comercio…" : "Crear Comercio"}
        </button>
      </form>
    </>
  );
}
