import { notFound } from 'next/navigation';
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

    return <MobileCard initialCustomer={customer} business={customer.businesses} notice={stampNotice(stampStatus)} />;
}
