"use client";

import { useRef, useState, useTransition, type DragEvent } from "react";
import { Building2, Camera, Gift, KeyRound, Loader2, Mail, Minus, Plus, Rocket, Store, Trash2, Stamp } from "lucide-react";
import { registerNewBusiness, type RegisterBusinessResult } from "@/app/actions/business";
import { BusinessDesign, emptyDesign } from '@/components/admin/BusinessDesign';

const MAX_LOGO_BYTES = 800 * 1024;
const MIN_STAMPS = 4;
const MAX_STAMPS = 15;

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-[#FF1F2D] focus:ring-2 focus:ring-red-100 disabled:opacity-60";
const labelClass = "mb-1.5 block text-sm font-semibold text-gray-700";
const cardClass = "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm";

export default function CrearComercioForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<RegisterBusinessResult | null>(null);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [stamps, setStamps] = useState(10);
  const [active, setActive] = useState(true);
  const [design, setDesign] = useState(emptyDesign);
  const [rewardDescription, setRewardDescription] = useState('');

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

  function changeStamps(value: number) {
    setStamps(Math.min(MAX_STAMPS, Math.max(MIN_STAMPS, Number.isFinite(value) ? Math.floor(value) : MIN_STAMPS)));
  }

  function handleSubmit(formData: FormData) {
    setResult(null);
    formData.delete("logo");
    if (logoFile) formData.set("logo", logoFile);
    formData.set("rewardTarget", String(stamps));
    formData.set("active", String(active));
    formData.set("primaryColor", design.primaryColor);
    formData.set("cardTextColor", design.textColor);
    formData.set("cardAccentColor", design.accentColor);
    formData.set("stampSource", design.source || '');
    formData.set("stampCatalogId", design.catalogId || '');
    formData.set("stampEffect", JSON.stringify(design.effect));
    if (design.customFile) formData.set("stampFile", design.customFile);

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
          setRewardDescription('');
        }
      } catch {
        setResult({ success: false, error: "Ocurrió un error inesperado. Intentá de nuevo." });
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-6">
      {/* Datos del negocio */}
      <section className={cardClass} aria-labelledby="datos-local">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#FF1F2D]">
            <Store size={20} />
          </div>
          <div>
            <h2 id="datos-local" className="text-base font-bold text-gray-900">Datos del negocio</h2>
            <p className="text-xs text-gray-500">Identidad del comercio y acceso del dueño.</p>
          </div>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row">
          {/* Logo y Compresor */}
          <div className="sm:w-44 sm:shrink-0">
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
                  <Camera size={30} strokeWidth={1.6} />
                  <span className="text-xs font-semibold">Subir logo del comercio</span>
                  <span className="text-[11px] text-gray-400">Arrastrá o hacé clic · máx. 800 KB</span>
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

            {/* Enlace de ayuda para comprimir imagen */}
            <p className="mt-2.5 text-[11px] leading-snug text-gray-500">
              ¿Tu imagen pesa más de 2MB?{" "}
              <a
                href="https://www.iloveimg.com/es/comprimir-imagen"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#FF1F2D] underline underline-offset-2 hover:text-[#e01826]"
              >
                Comprimila gratis acá
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
        <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5">
          <div>
            <p id="estado-label" className="text-sm font-semibold text-gray-900">Estado del comercio</p>
            <p className="text-xs text-gray-500">{active ? "Activo: los clientes pueden sumar sellos." : "Inactivo: el comercio queda pausado."}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-bold ${active ? "text-[#FF1F2D]" : "text-gray-400"}`}>
              {active ? "Activo" : "Inactivo"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-labelledby="estado-label"
              disabled={isPending}
              onClick={() => setActive((value) => !value)}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1F2D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                active ? "bg-[#FF1F2D]" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  active ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      <BusinessDesign value={design} onChange={setDesign} logoPreview={logoPreview} rewardTarget={stamps} rewardDescription={rewardDescription} disabled={isPending} />

      {/* Programa de sellos */}
      <section className={cardClass} aria-labelledby="programa-sellos">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#FF1F2D]">
            <Stamp size={20} />
          </div>
          <div>
            <h2 id="programa-sellos" className="text-base font-bold text-gray-900">Programa de fidelización</h2>
            <p className="text-xs text-gray-500">Definí cuánto cuesta ganar el premio.</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
          <div>
            <label htmlFor="rewardTarget" className={labelClass}>Meta de sellos</label>
            <div className="inline-flex items-center overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => changeStamps(stamps - 1)}
                disabled={isPending || stamps <= MIN_STAMPS}
                aria-label="Restar un sello"
                className="flex h-11 w-11 items-center justify-center text-gray-600 transition hover:bg-red-50 hover:text-[#FF1F2D] disabled:opacity-40"
              >
                <Minus size={16} />
              </button>
              <input
                id="rewardTarget"
                type="number"
                min={MIN_STAMPS}
                max={MAX_STAMPS}
                value={stamps}
                disabled={isPending}
                onChange={(e) => changeStamps(Number(e.target.value))}
                className="h-11 w-16 border-x border-gray-200 bg-white text-center text-sm font-bold text-gray-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => changeStamps(stamps + 1)}
                disabled={isPending || stamps >= MAX_STAMPS}
                aria-label="Sumar un sello"
                className="flex h-11 w-11 items-center justify-center text-gray-600 transition hover:bg-red-50 hover:text-[#FF1F2D] disabled:opacity-40"
              >
                <Plus size={16} />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">Sellos necesarios para el premio.</p>
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
                onChange={e => setRewardDescription(e.target.value)}
                disabled={isPending}
                className={inputClass}
                placeholder='Ej: "Un café gratis"'
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">Si lo dejás vacío se usa &ldquo;Un beneficio gratis&rdquo;.</p>
          </div>
        </div>
      </section>

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#FF1F2D] px-6 py-4 text-base font-bold text-white shadow-lg shadow-red-200 transition hover:bg-[#e01826] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <Loader2 size={20} className="animate-spin" /> : <Rocket size={20} />}
        {isPending ? "Creando comercio…" : "Crear Comercio"}
      </button>

      {result?.success && (
        <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
          ✅ ¡Comercio creado con éxito! El dueño ya puede iniciar sesión.
        </div>
      )}
      {result && !result.success && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
          ❌ {result.error}
        </div>
      )}
    </form>
  );
}
