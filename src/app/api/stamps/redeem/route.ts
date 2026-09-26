import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { identifier } = body;

        if (!identifier) {
            return NextResponse.json({ error: 'Missing customer identifier' }, { status: 400 });
        }

        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('id, current_stamps, business_id')
            .or(`id.eq.${identifier},unique_code.eq.${identifier}`)
            .single();

        if (customerError || !customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        if (customer.current_stamps < 10) {
            return NextResponse.json({ error: 'Not enough stamps to redeem' }, { status: 400 });
        }

        const { error: updateError } = await supabase
            .from('customers')
            .update({
                current_stamps: 0,
                last_visit_at: new Date().toISOString()
            })
            .eq('id', customer.id);

        if (updateError) {
            throw updateError;
        }

        await supabase.from('stamp_logs').insert([
            {
                customer_id: customer.id,
                business_id: customer.business_id,
                method: 'MANUAL'
            }
        ]);

        return NextResponse.json({ success: true, message: 'Prize redeemed successfully!' });

    } catch (error) {
        console.error('Error redeeming stamp:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
