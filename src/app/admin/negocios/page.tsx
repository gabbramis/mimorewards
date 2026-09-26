"use client";
import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Save, X, Loader2 } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function NegociosPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", logo_url: "", reward_target: 10, reward_description: "" });
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      setIsLoading(true);
      supabase.from("businesses").select("*").order("name").then(r => { setBusinesses(r.data || []); setIsLoading(false); });
    }
    }, []);

  async function handleSave() {
    if (!form.name.trim()) return;
    try {
      if (editing) {
        await supabase.from("businesses").update(form).eq("id", editing.id);
      } else {
        await supabase.from("businesses").insert([form]);
      }
      setShowModal(false);
      setEditing(null);
      setForm({ name: "", logo_url: "", reward_target: 10, reward_description: "" });
      setIsLoading(true);
      const { data } = await supabase.from("businesses").select("*").order("name");
      setBusinesses(data || []);
      setIsLoading(false);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Seguro que deseas eliminar este negocio?")) return;
    await supabase.from("businesses").delete().eq("id", id);
    setIsLoading(true);
    const { data } = await supabase.from("businesses").select("*").order("name");
    setBusinesses(data || []);
    setIsLoading(false);
  }

  function openEdit(b: any) {
    setEditing(b);
    setForm({ name: b.name || "", logo_url: b.logo_url || "", reward_target: b.reward_target || 10, reward_description: b.reward_description || "" });
    setShowModal(true);
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", logo_url: "", reward_target: 10, reward_description: "" });
    setShowModal(true);
  }

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Negocios</h1>
          <p className="text-gray-500 text-sm mt-1.5 font-medium">Gestioná los negocios registrados y su branding.</p>
        </div>
        <button onClick={openCreate} className="bg-black text-white px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-gray-800 transition shadow-sm">
          <Plus size={18} /> Nuevo Negocio
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">LOGO</th>
                <th className="px-6 py-4 font-bold">NOMBRE</th>
                <th className="px-6 py-4 font-bold">SELLOS</th>
                <th className="px-6 py-4 font-bold">RECOMPRA</th>
                <th className="px-6 py-4 font-bold text-right">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {businesses.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">No hay negocios registrados.</td></tr>
              ) : businesses.map(b => (
                <tr key={b.id} className="hover:bg-gray-50/80 transition">
                  <td className="px-6 py-4">
                    {b.logo_url ? (
                      <Image src={b.logo_url} alt={b.name} width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">Sin logo</div>
                    )}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{b.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{b.reward_target}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{b.reward_description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(b)} className="text-blue-700 hover:text-blue-900 p-1.5 rounded-lg hover:bg-blue-50 transition" title="Editar">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(b.id)} className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition" title="Eliminar">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">{editing ? "Editar Negocio" : "Nuevo Negocio"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition"><X size={20} /></button>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 block">Nombre del negocio</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition" placeholder="Ej: El Gran Café" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 block">URL del logo</label>
              <input type="text" value={form.logo_url} onChange={e => setForm({...form, logo_url: e.target.value})} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition" placeholder="https://ejemplo.com/logo.png" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 block">Sello objetivo</label>
                <input type="number" value={form.reward_target} onChange={e => setForm({...form, reward_target: Number(e.target.value)})} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 block">Recompensa</label>
                <input type="text" value={form.reward_description} onChange={e => setForm({...form, reward_description: e.target.value})} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 outline-none transition" placeholder="Ej: Un café gratis" />
              </div>
            </div>
            <button onClick={handleSave} className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-sm mt-2 flex items-center justify-center gap-2">
              <Save size={18} /> {editing ? "Guardar Cambios" : "Crear Negocio"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
