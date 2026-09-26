"use client";
import React from 'react';
import { useState, use } from "react";
import { UserPlus, UserIcon, Phone, Calendar, Loader2, AlertCircle } from "lucide-react";
import { createClient } from '@/lib/supabase/client';

export default function JoinLoyaltyProgram({ params }) {
    const resolvedParams = use(params);
    const businessId = resolvedParams.businessId;
    const supabase = createClient();

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        phone: "",
        birthdate: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [newCustomer, setNewCustomer] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMsg("");

        // Generate a unique 5-digit code
        const uniqueCodeStr = "CLI-" + Math.floor(10000 + Math.random() * 90000);

        try {
            const { data, error } = await supabase
                .from('customers')
                .insert([{
                    business_id: businessId,
                    unique_code: uniqueCodeStr,
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    phone: formData.phone,
                    birthdate: formData.birthdate
                }])
                .select()
                .single();

            if (error) throw error;

            setNewCustomer({
                firstName: data.first_name,
                lastName: data.last_name,
                uniqueCode: data.unique_code,
            });
        } catch (err) {
            console.error(err);
            setErrorMsg(`Error reportado por Supabase: ${err.message || JSON.stringify(err)}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (newCustomer) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
                <div className="bg-white max-w-sm w-full rounded-3xl p-8 shadow-xl text-center">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <UserPlus size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Bienvenido/a, {newCustomer.firstName}!</h2>
                    <p className="text-gray-500 mb-6 text-sm">Tu cuenta ha sido creada exitosamente. Puedes usar este número en la caja:</p>

                    <div className="bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-300 mb-8">
                        <p className="text-4xl font-black tracking-widest text-gray-800">
                            {newCustomer.uniqueCode}
                        </p>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button className="w-full bg-black text-white rounded-xl py-3 px-4 font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 transition shadow">
                            Añadir a Apple Wallet
                        </button>
                        <button className="w-full bg-[#1A73E8] text-white rounded-xl py-3 px-4 font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition shadow">
                            Guardar en Google Wallet
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 font-sans">
            <div className="w-full max-w-md mt-6 sm:mt-10">

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Mimo Rewards</h1>
                    <p className="text-gray-600">Únete al programa de fidelización y empieza a sumar visitas para obtener premios.</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 flex flex-col gap-5">
                    {errorMsg && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm font-medium">
                            <AlertCircle size={16} />
                            {errorMsg}
                        </div>
                    )}

                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nombre</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                    <UserIcon size={18} />
                                </div>
                                <input
                                    type="text"
                                    required
                                    placeholder="Tu nombre"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900 bg-white"
                                    value={formData.firstName}
                                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Apellido</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                    <UserIcon size={18} />
                                </div>
                                <input
                                    type="text"
                                    required
                                    placeholder="Tu apellido"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900 bg-white"
                                    value={formData.lastName}
                                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Teléfono o WhatsApp</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                    <Phone size={18} />
                                </div>
                                <input
                                    type="tel"
                                    required
                                    placeholder="+54 9 11 1234-5678"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-gray-900 bg-white"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Fecha de Nacimiento</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                                    <Calendar size={18} />
                                </div>
                                <input
                                    type="date"
                                    required
                                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-medium text-gray-900 bg-white"
                                    value={formData.birthdate}
                                    onChange={e => setFormData({ ...formData, birthdate: e.target.value })}
                                    disabled={isSubmitting}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2 font-medium">Usaremos esta fecha para enviarte beneficios el día de tu cumpleaños. 🎉</p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-blue-600 text-white rounded-xl py-4 font-bold text-lg hover:bg-blue-700 transition mt-2 shadow-lg shadow-blue-200 flex justify-center items-center disabled:opacity-75"
                    >
                        {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : "Unirme ahora"}
                    </button>
                </form>
            </div>
        </div>
    );
}
