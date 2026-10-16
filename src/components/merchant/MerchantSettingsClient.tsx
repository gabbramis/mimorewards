"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Store,
  Sparkles,
  Users,
  Save,
  Upload,
  Check,
  AlertCircle,
  CheckCircle2,
  Trash2,
  UserPlus,
  X,
  RefreshCw,
  Gift,
  Stamp,
  CreditCard,
} from "lucide-react";

interface Member {
  userId: string;
  email: string;
  displayName: string | null;
  role: "merchant" | "staff";
  createdAt: string;
  isCurrentUser: boolean;
}

interface MerchantSettingsClientProps {
  businessId: string;
  initialBusiness: {
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    reward_target: number;
    reward_description: string;
    active: boolean;
  };
}

export default function MerchantSettingsClient({
  businessId,
  initialBusiness,
}: MerchantSettingsClientProps) {
  // Datos del Negocio
  const [name, setName] = useState(initialBusiness.name);
  const [primaryColor, setPrimaryColor] = useState(
    initialBusiness.primary_color || "#FF1F2D"
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    initialBusiness.logo_url
  );

  // Reglas del Programa
  const [rewardTarget, setRewardTarget] = useState(
    initialBusiness.reward_target || 10
  );
  const [rewardDescription, setRewardDescription] = useState(
    initialBusiness.reward_description || "1 Café de especialidad + Alfajor artesanal"
  );

  // Equipo
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Modal Invitar Miembro
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"merchant" | "staff">("staff");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviting, setInviting] = useState(false);

  // Estado de Guardado
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Cargar miembros
  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const res = await fetch(`/api/comercio/members?businessId=${businessId}`);
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members || []);
      }
    } catch (err) {
      console.error("Error loading team members:", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [businessId]);

  // Selección de Logo
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("El archivo seleccionado debe ser una imagen.", "error");
      return;
    }
    if (file.size > 800 * 1024) {
      showToast("El logo no debe superar los 800 KB.", "error");
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  // Guardar Configuración
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (saving) return;

    if (!name.trim()) {
      showToast("El nombre del comercio es obligatorio.", "error");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("businessId", businessId);
      fd.append("name", name.trim());
      fd.append("rewardTarget", String(rewardTarget));
      fd.append("rewardDescription", rewardDescription.trim());
      fd.append("primaryColor", primaryColor);
      if (logoFile) {
        fd.append("logo", logoFile);
      }

      const res = await fetch("/api/comercio/settings", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudo guardar la configuración.");
      }

      showToast("Configuración del local guardada exitosamente.", "success");
    } catch (err: any) {
      showToast(err.message || "Error al guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Invitar / Agregar Miembro
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || inviting) return;

    setInviting(true);
    try {
      const res = await fetch("/api/comercio/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          email: inviteEmail.trim(),
          displayName: inviteName.trim(),
          role: inviteRole,
          password: invitePassword.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al invicar miembro.");
      }

      showToast(data.message || "Miembro agregado con éxito.", "success");
      setInviteModalOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInvitePassword("");
      fetchMembers();
    } catch (err: any) {
      showToast(err.message || "Error al invitar.", "error");
    } finally {
      setInviting(false);
    }
  };

  // Revocar Miembro
  const handleRevokeMember = async (userId: string, email: string) => {
    if (!confirm(`¿Estás seguro de que deseás desvincular a ${email}?`)) {
      return;
    }

    try {
      const res = await fetch(
        `/api/comercio/members?businessId=${businessId}&userId=${userId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al revocar acceso.");
      }

      showToast("Acceso revocado correctamente.", "success");
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (err: any) {
      showToast(err.message || "Error al revocar.", "error");
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Feedback */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-xl border text-sm font-semibold transition-all ${
            toast.type === "success"
              ? "bg-white border-[#10B981] text-[#1F1F1F] shadow-[#10B981]/10"
              : "bg-white border-[#FF1F2D] text-[#1F1F1F] shadow-[#FF1F2D]/10"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={18} className="text-[#10B981] shrink-0" />
          ) : (
            <AlertCircle size={18} className="text-[#FF1F2D] shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header & Save Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#737373]">
            Ajustes del Comercio
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-[#1F1F1F]">
            Configuración del local
          </h2>
          <p className="text-xs text-[#737373] mt-0.5">
            Administrá la identidad de tu negocio, las reglas de sellos y los
            accesos del equipo.
          </p>
        </div>

        {/* Botón Guardar Cambios */}
        <button
          type="button"
          disabled={saving}
          onClick={() => handleSaveSettings()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#FF1F2D] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#E01522] disabled:opacity-50 transition-colors shrink-0"
        >
          {saving ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>Guardando cambios...</span>
            </>
          ) : (
            <>
              <Save size={14} />
              <span>Guardar cambios</span>
            </>
          )}
        </button>
      </div>

      {/* Grid Principal: 2 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda (2 cols): Datos del Negocio & Reglas del Programa */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Datos del Negocio */}
          <section className="rounded-2xl border border-[#F0E6DE] bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-[#F0E6DE]">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF0F1] text-[#FF1F2D]">
                <Store size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1F1F1F]">
                  Datos del negocio
                </h3>
                <p className="text-[11px] text-[#737373]">
                  Nombre, identidad y color institucional de la tarjeta.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Nombre */}
              <div>
                <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">
                  Nombre comercial del local
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Café Martínez Palermo"
                  className="w-full rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] py-2.5 px-3.5 text-xs text-[#1F1F1F] focus:border-[#FF1F2D] focus:bg-white focus:outline-none"
                />
              </div>

              {/* Logo con subida */}
              <div>
                <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">
                  Logo del comercio
                </label>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[#F0E6DE] bg-[#FFF9F5] overflow-hidden">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Logo Preview"
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <Store size={22} className="text-[#A3A3A3]" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-[#F0E6DE] bg-white px-3.5 py-2 text-xs font-semibold text-[#1F1F1F] hover:bg-[#FFF9F5] hover:border-[#E2D5CB] cursor-pointer transition-colors shadow-2xs">
                      <Upload size={14} className="text-[#737373]" />
                      <span>Subir nuevo logo</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-[#737373]">
                      PNG, JPG o WebP con fondo transparente recomendado (máx. 800 KB).
                    </p>
                  </div>
                </div>
              </div>

              {/* Color Primario de Tarjeta */}
              <div>
                <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">
                  Color primario de la tarjeta
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-xl border border-[#F0E6DE] bg-white p-1"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-32 rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] py-2 px-3 text-xs font-mono font-semibold text-[#1F1F1F] uppercase focus:border-[#FF1F2D] focus:bg-white focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5">
                    {["#FF1F2D", "#1E1E1E", "#0F766E", "#7C3AED", "#EA580C"].map(
                      (preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setPrimaryColor(preset)}
                          style={{ backgroundColor: preset }}
                          className={`h-6 w-6 rounded-full border-2 transition-transform ${
                            primaryColor.toUpperCase() === preset
                              ? "scale-110 border-black"
                              : "border-transparent hover:scale-105"
                          }`}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Card 2: Reglas del Programa */}
          <section className="rounded-2xl border border-[#F0E6DE] bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-[#F0E6DE]">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF0F1] text-[#FF1F2D]">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1F1F1F]">
                  Reglas del programa de sellos
                </h3>
                <p className="text-[11px] text-[#737373]">
                  Meta de acumulación y premio activo que reciben tus clientes.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Meta de Sellos */}
              <div>
                <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">
                  Meta de sellos necesarios para canjear
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={4}
                    max={15}
                    value={rewardTarget}
                    onChange={(e) => setRewardTarget(Number(e.target.value))}
                    className="w-24 rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] py-2.5 px-3.5 text-xs font-bold text-[#1F1F1F] focus:border-[#FF1F2D] focus:bg-white focus:outline-none"
                  />
                  <span className="text-xs text-[#737373]">
                    sellos por tarjeta (mínimo 4, máximo 15)
                  </span>
                </div>
              </div>

              {/* Descripción del Premio */}
              <div>
                <label className="block text-xs font-bold text-[#1F1F1F] mb-1.5">
                  Título y descripción del premio activo
                </label>
                <input
                  type="text"
                  value={rewardDescription}
                  onChange={(e) => setRewardDescription(e.target.value)}
                  placeholder="Ej. 1 Café de especialidad + Alfajor artesanal"
                  className="w-full rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] py-2.5 px-3.5 text-xs text-[#1F1F1F] focus:border-[#FF1F2D] focus:bg-white focus:outline-none"
                />
                <p className="text-[11px] text-[#737373] mt-1">
                  Este texto se mostrará en la tarjeta digital del cliente y en
                  las notificaciones de canje.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Columna Derecha (1 col): Preview de Tarjeta & Accesos del Equipo */}
        <div className="space-y-6">
          {/* Preview de Tarjeta Digital */}
          <div className="rounded-2xl border border-[#F0E6DE] bg-white p-5 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#737373]">
              Vista previa de la tarjeta
            </span>
            <div
              style={{ backgroundColor: primaryColor }}
              className="mt-3 rounded-2xl p-5 text-white shadow-md relative overflow-hidden transition-colors"
            >
              {/* Decoración geométrica */}
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />

              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold tracking-tight uppercase">
                  {name || "Tu Comercio"}
                </span>
                <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
                  mimo rewards
                </span>
              </div>

              <div className="mb-5">
                <p className="text-[11px] text-white/80">Recompensa</p>
                <p className="text-sm font-bold truncate">
                  {rewardDescription || "Premio activo"}
                </p>
              </div>

              {/* Casilleros de Sellos en Tarjeta */}
              <div className="grid grid-cols-5 gap-1.5">
                {Array.from({ length: rewardTarget }).map((_, i) => {
                  const isDone = i < 3;
                  const isLast = i === rewardTarget - 1;
                  return (
                    <div
                      key={i}
                      className={`h-7 rounded-lg flex items-center justify-center font-bold text-[10px] transition-colors ${
                        isDone
                          ? "bg-white text-[#1F1F1F] shadow-2xs"
                          : "bg-black/20 text-white/60 border border-white/20"
                      }`}
                    >
                      {isLast ? (
                        <Gift size={13} className={isDone ? "text-[#FF1F2D]" : ""} />
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-[10px] text-white/80">
                <span>Cliente: Juan Pérez</span>
                <span>CLI-849201</span>
              </div>
            </div>
            <p className="text-[11px] text-[#737373] mt-2.5 text-center">
              Así visualizarán sus pases los usuarios en Apple / Google Wallet.
            </p>
          </div>

          {/* Card 3: Accesos del Equipo */}
          <section className="rounded-2xl border border-[#F0E6DE] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F0E6DE]">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-[#FF1F2D]" />
                <h3 className="text-sm font-bold text-[#1F1F1F]">
                  Accesos del equipo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInviteModalOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#FFF0F1] px-2.5 py-1 text-[11px] font-bold text-[#FF1F2D] hover:bg-[#FFE5E8] transition-colors"
              >
                <UserPlus size={12} />
                <span>+ Invitar</span>
              </button>
            </div>

            <p className="text-[11px] text-[#737373] mb-3">
              Usuarios autorizados para operar este local en Mimo Rewards.
            </p>

            {loadingMembers ? (
              <div className="py-6 text-center text-xs text-[#737373]">
                <RefreshCw size={16} className="animate-spin mx-auto mb-2 text-[#737373]" />
                Cargando miembros...
              </div>
            ) : members.length > 0 ? (
              <div className="space-y-2.5">
                {members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] p-2.5"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-[#1F1F1F] truncate">
                        {m.displayName || m.email}
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] text-[#737373]">
                        <span className="truncate">{m.email}</span>
                        <span>•</span>
                        <span
                          className={`font-semibold ${
                            m.role === "merchant"
                              ? "text-[#FF1F2D]"
                              : "text-[#0284C7]"
                          }`}
                        >
                          {m.role === "merchant"
                            ? "Administrador"
                            : "Personal de mostrador"}
                        </span>
                      </div>
                    </div>

                    {!m.isCurrentUser && (
                      <button
                        type="button"
                        onClick={() => handleRevokeMember(m.userId, m.email)}
                        title="Revocar acceso"
                        className="rounded-lg p-1.5 text-[#737373] hover:bg-[#FFF0F1] hover:text-[#FF1F2D] transition-colors shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#737373] text-center py-4">
                No hay otros miembros vinculados aún.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Modal: + Invitar Miembro */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div
            className="w-full max-w-md rounded-3xl border border-[#F0E6DE] bg-white p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#F0E6DE] pb-3">
              <h3 className="text-base font-bold text-[#1F1F1F]">
                Invitar miembro al equipo
              </h3>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="rounded-lg p-1 text-[#737373] hover:bg-[#FFF9F5]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1F1F1F] mb-1">
                  Nombre o apodo
                </label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Ej. Lucas (Cajero Turno Mañana)"
                  className="w-full rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] py-2 px-3 text-xs text-[#1F1F1F] focus:border-[#FF1F2D] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1F1F] mb-1">
                  Correo electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="empleado@comercio.com"
                  className="w-full rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] py-2 px-3 text-xs text-[#1F1F1F] focus:border-[#FF1F2D] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1F1F] mb-1">
                  Rol asignado
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] py-2 px-3 text-xs text-[#1F1F1F] focus:border-[#FF1F2D] focus:bg-white focus:outline-none"
                >
                  <option value="staff">Personal de mostrador (Caja)</option>
                  <option value="merchant">Administrador del comercio</option>
                </select>
                <p className="text-[10px] text-[#737373] mt-1">
                  El personal de mostrador solo puede asignar sellos y validar
                  canjes.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F1F1F] mb-1">
                  Contraseña inicial (opcional si es usuario nuevo)
                </label>
                <input
                  type="password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] py-2 px-3 text-xs text-[#1F1F1F] focus:border-[#FF1F2D] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[#F0E6DE] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="rounded-xl border border-[#F0E6DE] bg-white px-3.5 py-2 text-xs font-semibold text-[#737373] hover:bg-[#FFF9F5]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={inviting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF1F2D] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#E01522] disabled:opacity-50"
                >
                  {inviting ? "Vinculando..." : "Vincular miembro"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
