"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus, ShieldCheck, Trash2, UserRound, X } from "lucide-react";

type Business = { id: string; name: string; active: boolean };
type Membership = { business_id: string; businessName: string; role: "merchant" | "staff"; businessActive: boolean };
type ManagedUser = { id: string; email: string; createdAt: string; profile: { role: string; display_name: string | null } | null; memberships: Membership[] };

export default function AccessPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [role, setRole] = useState<"merchant" | "staff">("merchant");
  const [displayName, setDisplayName] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/members", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudieron cargar los accesos.");
      setUsers(payload.users || []);
      setBusinesses(payload.businesses || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los accesos.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const availableUsers = useMemo(() => users.filter((user) => user.profile?.role !== "superadmin"), [users]);

  async function assignAccess() {
    if (!selectedUser || !selectedBusiness || isSaving) return;
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser, businessId: selectedBusiness, role, displayName }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo asignar el acceso.");
      setSuccess("Acceso asignado correctamente.");
      setSelectedBusiness("");
      setDisplayName("");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo asignar el acceso.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeAccess(userId: string, businessId: string, businessName: string) {
    if (!window.confirm(`¿Quitar el acceso a ${businessName}?`)) return;
    const response = await fetch("/api/admin/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, businessId }),
    });
    const payload = await response.json();
    if (!response.ok) setError(payload.error || "No se pudo quitar el acceso.");
    else { setSuccess("Acceso quitado."); await load(); }
  }

  return (
    <div className="p-6 sm:p-10 max-w-6xl mx-auto font-sans">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center"><ShieldCheck size={22} /></div>
          <div><h1 className="text-3xl font-bold text-gray-900 tracking-tight">Accesos</h1><p className="text-gray-500 text-sm mt-1.5 font-medium">Asigná usuarios a los comercios que pueden administrar.</p></div>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm font-semibold">{error}</div>}
      {success && <div className="mb-4 rounded-xl bg-green-50 border border-green-100 text-green-700 px-4 py-3 text-sm font-semibold flex items-center gap-2"><Check size={17} />{success}</div>}

      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Plus size={19} />Asignar acceso</h2>
        <p className="text-sm text-gray-500 mt-1 mb-5">Los usuarios se crean desde Authentication. Acá solo definís qué comercio pueden administrar.</p>
        <div className="grid gap-4 md:grid-cols-4">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600 md:col-span-1">Usuario<select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-900"><option value="">Seleccionar usuario</option>{availableUsers.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}</select></label>
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Comercio<select value={selectedBusiness} onChange={(event) => setSelectedBusiness(event.target.value)} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-900"><option value="">Seleccionar comercio</option>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}{business.active ? "" : " (inactivo)"}</option>)}</select></label>
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Rol<select value={role} onChange={(event) => setRole(event.target.value as "merchant" | "staff")} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-900"><option value="merchant">Merchant</option><option value="staff">Staff</option></select></label>
          <label className="text-xs font-bold uppercase tracking-wider text-gray-600">Nombre visible<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Opcional" className="mt-1.5 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-900" /></label>
        </div>
        <button type="button" onClick={assignAccess} disabled={!selectedUser || !selectedBusiness || isSaving} className="mt-5 rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-bold hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-2">{isSaving ? <Loader2 size={17} className="animate-spin" /> : <UserRound size={17} />}Asignar acceso</button>
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100"><h2 className="font-bold text-gray-900">Usuarios y comercios</h2></div>
        {isLoading ? <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-gray-400" /></div> : <div className="divide-y divide-gray-100">{users.map((user) => <div key={user.id} className="p-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="font-semibold text-gray-900">{user.profile?.display_name || user.email}</div><div className="text-sm text-gray-500">{user.email}<span className="mx-2 text-gray-300">·</span>{user.profile?.role || "Sin perfil"}</div></div><div className="flex flex-wrap gap-2 lg:justify-end">{user.profile?.role === "superadmin" ? <span className="rounded-full bg-red-50 text-red-700 px-3 py-1.5 text-xs font-bold">Superadmin · todos los comercios</span> : user.memberships.length ? user.memberships.map((membership) => <span key={`${user.id}-${membership.business_id}`} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 text-gray-700 px-3 py-1.5 text-xs font-semibold">{membership.businessName} · {membership.role}<button type="button" onClick={() => removeAccess(user.id, membership.business_id, membership.businessName)} className="text-gray-400 hover:text-red-600" aria-label={`Quitar acceso a ${membership.businessName}`}><X size={14} /></button></span>) : <span className="text-sm text-gray-400">Sin comercios asignados</span>}</div></div>)}{users.length === 0 && <div className="p-10 text-center text-gray-500">No hay usuarios registrados.</div>}</div>}
      </section>
    </div>
  );
}
