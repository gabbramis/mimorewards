import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MobileCard from './MobileCard';

export default async function TarjetaPage({ params }: { params: Promise<{ customer_id: string }> }) {
    const { customer_id } = await params;
    const supabase = await createClient();

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

    return <MobileCard initialCustomer={customer} business={customer.businesses} />;
}
