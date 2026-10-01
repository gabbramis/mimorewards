import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import MobileCard from './MobileCard';

function stampNotice(status: string | null) {
    if (status === "success") return "¡Sello sumado! Gracias por volver.";
    if (status === "cooldown") return "Ya registraste tu visita recientemente.";
    if (status === "reward_pending") return "Tu recompensa ya está disponible para canjear.";
    if (status === "program_inactive") return "Este programa está pausado por ahora.";
    if (status === "error") return "No pudimos registrar la visita. Probá de nuevo en un momento.";
    return null;
}

export default async function TarjetaPage({ params, searchParams }: { params: Promise<{ customer_id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const { customer_id } = await params;
    const query = await searchParams;
    const stampStatus = typeof query.stamp === "string" ? query.stamp : null;
    const supabase: any = createAdminClient();

    const { data: customer } = await supabase
        .from('customers')
        .select(`
            *,
            businesses (*)
        `)
        .eq('id', customer_id)
        .single();

    if (!customer || !customer.businesses) {
        notFound();
    }

    if (stampStatus === "cooldown") {
        return (
            <main className="min-h-screen flex items-center justify-center bg-[#FBECE0] p-4 text-[#1F1F1F]">
                <div className="bg-white rounded-3xl ring-2 ring-[#FF1F2D] ring-offset-4 ring-offset-[#FBECE0] p-8 max-w-sm w-full text-center shadow-lg shadow-black/[0.04] flex flex-col items-center">
                    <div className="bg-[#FFF6EE] p-4 rounded-full mb-6 mt-2">
                        <Heart className="w-8 h-8 text-[#FF1F2D]" fill="currentColor" />
                    </div>
                    <h1 className="text-2xl font-bold mb-4 tracking-tight">
                        ¡Qué lindo verte de nuevo en {customer.businesses.name}!
                    </h1>
                    <p className="text-[#1F1F1F] opacity-90 mb-8 leading-relaxed font-medium">
                        Tu visita de hoy ya fue registrada con éxito. Para cuidar tus sellos, hay un tiempo de espera de 3 horas entre cada visita. ¡Te esperamos pronto!
                    </p>
                    <Link href={`/tarjeta/${customer.id}`} className="bg-[#FF1F2D] text-white font-bold rounded-2xl py-4 px-6 hover:bg-[#E01724] transition-colors w-full block shadow-sm">
                        Ver mi tarjeta actual
                    </Link>
                </div>
            </main>
        );
    }

    return <MobileCard initialCustomer={customer} business={customer.businesses} notice={stampNotice(stampStatus)} />;
}
