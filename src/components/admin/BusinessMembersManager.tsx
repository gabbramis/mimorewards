"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, UserPlus, Users, X } from "lucide-react";

type AssignedUser = {
  userId: string;
  email: string;
  role: "merchant" | "staff";
  displayName: string | null;
  createdAt?: string;
};

type AvailableUser = {
  userId: string;
  email: string;
  displayName: string | null;
};

export function BusinessMembersManager({ businessId }: { businessId: string }) {
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);

  const [tab, setTab] = useState<"link" | "create">("link");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [role, setRole] = useState<"merchant" | "staff">("merchant");
  const [displayName, setDisplayName] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/members?businessId=${encodeURIComponent(businessId)}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudieron cargar los accesos.");
      }
      setAssignedUsers(data.assignedUsers || []);
      setAvailableUsers(data.availableUsers || []);
    } catch (err: any) {
      setError(err?.message || "Error al cargar los accesos.");
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAssign() {
    if (!selectedUserId || isSaving) return;
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          businessId,
          role,
          displayName: displayName.trim() || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "No se pudo asignar el acceso.");

      setSuccess("Acceso asignado correctamente.");
      setSelectedUserId("");
      setDisplayName("");
      setRole("merchant");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "No se pudo asignar el acceso.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreate() {
    if (!newEmail || !newPassword || isSaving) return;
    setIsSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isNewUser: true,
          email: newEmail.trim(),
          password: newPassword,
          businessId,
          role,
          displayName: displayName.trim() || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "No se pudo crear el usuario.");

      setSuccess(`Usuario creado y vinculado exitosamente.`);
      setNewEmail("");
      setNewPassword("");
      setDisplayName("");
      setRole("merchant");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "No se pudo crear el usuario.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRevoke(userId: string, email: string) {
    if (isSaving || revokingUserId) return;
    const confirmed = window.confirm(`¿Seguro que deseás quitar el acceso de ${email} a este local?`);
    if (!confirmed) return;

    setRevokingUserId(userId);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, businessId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "No se pudo quitar el acceso.");

      setSuccess("Acceso revocado correctamente.");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "No se pudo quitar el acceso.");
    } finally {
      setRevokingUserId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Users size={18} className="text-[#FF1F2D]" />
        <h2 className="font-bold text-gray-900 text-base">Accesos del comercio</h2>
      </div>
      <p className="text-xs text-gray-500 mb-6">
        Usuarios autorizados para operar la caja o administrar este local.
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Columna Izquierda: Lista de usuarios activos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Usuarios activos ({assignedUsers.length})
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-xs text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin text-gray-500" />
              Cargando accesos...
            </div>
          ) : assignedUsers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center text-xs text-gray-400">
              No hay usuarios vinculados a este local todavía.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[290px] overflow-y-auto pr-1">
              {assignedUsers.map((user) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white p-3 shadow-xs hover:border-gray-300 transition-colors"
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 truncate">
                        {user.email}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          user.role === "merchant"
                            ? "bg-red-50 text-[#FF1F2D] border border-red-200/60"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {user.role}
                      </span>
                    </div>
                    {user.displayName && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {user.displayName}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(user.userId, user.email)}
                    disabled={isSaving || revokingUserId === user.userId}
                    title="Quitar acceso a este local"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    {revokingUserId === user.userId ? (
                      <Loader2 size={16} className="animate-spin text-red-500" />
                    ) : (
                      <X size={16} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Columna Derecha: Asignar o Crear Usuario */}
        <div className="lg:border-l lg:border-gray-200 lg:pl-8">
          <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
            {/* Toggle / Pestañas */}
            <div className="flex p-1 bg-gray-200/70 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => {
                  setTab("link");
                  setError("");
                  setSuccess("");
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  tab === "link"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Vincular existente
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("create");
                  setError("");
                  setSuccess("");
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  tab === "create"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Crear nuevo usuario
              </button>
            </div>

            {/* Opcion A: Vincular existente */}
            {tab === "link" && (
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Usuario de Authentication
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    disabled={isSaving || availableUsers.length === 0}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1F2D]/20 focus:border-[#FF1F2D]"
                  >
                    <option value="">
                      {availableUsers.length === 0
                        ? "No hay usuarios disponibles para vincular"
                        : "Seleccioná un usuario..."}
                    </option>
                    {availableUsers.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.email}
                        {u.displayName ? ` (${u.displayName})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Rol
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as "merchant" | "staff")}
                      disabled={isSaving}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1F2D]/20 focus:border-[#FF1F2D]"
                    >
                      <option value="merchant">Merchant</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Nombre visible (Opcional)
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={isSaving}
                      placeholder="Ej. Juan Pérez"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1F2D]/20 focus:border-[#FF1F2D]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={isSaving || !selectedUserId}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50 transition-colors"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Asignar acceso
                </button>
              </div>
            )}

            {/* Opcion B: Crear nuevo usuario */}
            {tab === "create" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={isSaving}
                    placeholder="usuario@comercio.com"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1F2D]/20 focus:border-[#FF1F2D]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isSaving}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1F2D]/20 focus:border-[#FF1F2D]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Rol
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as "merchant" | "staff")}
                      disabled={isSaving}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1F2D]/20 focus:border-[#FF1F2D]"
                    >
                      <option value="merchant">Merchant</option>
                      <option value="staff">Staff</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Nombre visible (Opcional)
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={isSaving}
                      placeholder="Ej. Juan Pérez"
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF1F2D]/20 focus:border-[#FF1F2D]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isSaving || !newEmail || !newPassword}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF1F2D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#E01A26] disabled:opacity-50 transition-colors"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  Crear y asignar acceso
                </button>
              </div>
            )}

            {/* Alertas inline */}
            {error && (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700 border border-red-100">
                {error}
              </p>
            )}
            {success && (
              <p role="status" className="mt-3 rounded-lg bg-green-50 p-2.5 text-xs font-medium text-green-700 border border-green-100">
                {success}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
