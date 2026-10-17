"use client";

import React, { useState } from "react";
import { Sparkles, Save, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

interface MerchantRulesEditorProps {
  businessId: string;
  initialTarget: number;
  initialDescription: string;
  businessName: string;
}

export default function MerchantRulesEditor({
  businessId,
  initialTarget,
  initialDescription,
  businessName,
}: MerchantRulesEditorProps) {
  const [rewardTarget, setRewardTarget] = useState(initialTarget || 10);
  const [rewardDescription, setRewardDescription] = useState(
    initialDescription || "Beneficio de regalo"
  );
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (saving) return;

    if (!rewardDescription.trim()) {
      showToast("La descripción del premio no puede estar vacía.", "error");
      return;
    }

    if (rewardTarget < 4 || rewardTarget > 15) {
      showToast("La meta de sellos debe ser entre 4 y 15.", "error");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("businessId", businessId);
      fd.append("name", businessName);
      fd.append("rewardTarget", String(rewardTarget));
      fd.append("rewardDescription", rewardDescription.trim());

      const res = await fetch("/api/comercio/settings", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "No se pudieron guardar las reglas.");
      }

      showToast("¡Reglas del programa actualizadas con éxito!", "success");
      setIsEditing(false);
    } catch (err: any) {
      showToast(err.message || "Error al actualizar.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#F0E6DE] bg-white p-6 shadow-xs flex flex-col justify-between relative">
      {/* Toast Feedback */}
      {toast && (
        <div
          className={`absolute top-4 right-4 z-20 flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-md border animate-in fade-in ${
            toast.type === "success"
              ? "bg-white border-[#10B981] text-[#1F1F1F]"
              : "bg-white border-[#FF1F2D] text-[#1F1F1F]"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={15} className="text-[#10B981] shrink-0" />
          ) : (
            <AlertCircle size={15} className="text-[#FF1F2D] shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#1F1F1F] tracking-tight">
              Reglas del programa
            </h3>
            <p className="text-xs text-[#737373] mt-0.5">
              Configurá la meta y el premio que reciben tus clientes.
            </p>
          </div>
          <Sparkles size={16} className="text-[#FF1F2D]" />
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div>
              <label className="block text-xs font-bold text-[#1F1F1F] mb-1">
                Meta de sellos necesarios
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={4}
                  max={15}
                  value={rewardTarget}
                  onChange={(e) => setRewardTarget(Number(e.target.value))}
                  className="w-24 rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] py-2 px-3 text-xs font-bold text-[#1F1F1F] focus:border-[#FF1F2D] focus:bg-white focus:outline-none"
                />
                <span className="text-xs text-[#737373]">
                  sellos (entre 4 y 15)
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1F1F1F] mb-1">
                Premio activo
              </label>
              <input
                type="text"
                value={rewardDescription}
                onChange={(e) => setRewardDescription(e.target.value)}
                placeholder="Ej. 1 Café de especialidad + Alfajor"
                className="w-full rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] py-2 px-3 text-xs text-[#1F1F1F] focus:border-[#FF1F2D] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRewardTarget(initialTarget);
                  setRewardDescription(initialDescription);
                  setIsEditing(false);
                }}
                className="rounded-xl border border-[#F0E6DE] bg-white px-3.5 py-2 text-xs font-semibold text-[#737373] hover:bg-[#FFF9F5]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF1F2D] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#E01522] disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>Guardar reglas</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 mt-2">
            <div className="rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#737373]">
                Meta de fidelización
              </span>
              <p className="text-lg font-bold text-[#1F1F1F] mt-0.5">
                {rewardTarget} sellos
              </p>
              <p className="text-xs text-[#737373] mt-0.5">
                Cantidad requerida para completar la tarjeta.
              </p>
            </div>

            <div className="rounded-xl border border-[#F0E6DE] bg-[#FFF9F5] p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#737373]">
                Premio activo
              </span>
              <p className="text-sm font-bold text-[#1F1F1F] mt-0.5">
                {rewardDescription}
              </p>
              <p className="text-xs text-[#737373] mt-0.5">
                Visible en los pases digitales de tus clientes.
              </p>
            </div>
          </div>
        )}
      </div>

      {!isEditing && (
        <div className="mt-5 pt-4 border-t border-[#F0E6DE]">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#F0E6DE] bg-white py-2.5 text-xs font-semibold text-[#1F1F1F] hover:bg-[#FFF9F5] hover:border-[#E2D5CB] transition-colors"
          >
            Editar reglas del local
          </button>
        </div>
      )}
    </div>
  );
}
