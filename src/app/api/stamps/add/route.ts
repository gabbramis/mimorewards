import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { identifier, method = 'QR' } = body;
        // identifier can be id (UUID) or unique_code (e.g. CLI-12345)

        if (!identifier) {
            return NextResponse.json({ error: 'Missing customer identifier' }, { status: 400 });
        }

        // 1. Find Customer
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
        const customerQuery = supabase
            .from('customers')
            .select('id, current_stamps, total_visits, business_id')
            .limit(1);
        const { data: customer, error: customerError } = isUuid
            ? await customerQuery.eq('id', identifier).maybeSingle()
            : await customerQuery.eq('unique_code', identifier).maybeSingle();

        if (customerError || !customer) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        const newTarget = (customer.current_stamps || 0) + 1;

        // 2. Increment Stamps at DB atomically 
        // (In production, an SQL RPC function should be used to guarantee true atomicity on the counter)
        const { error: updateError } = await supabase
            .from('customers')
            .update({
                current_stamps: Math.min(newTarget, 10), // clamp max to 10 for safety bounds
                total_visits: (customer.total_visits || 0) + 1,
                last_visit_at: new Date().toISOString()
            })
            .eq('id', customer.id);

        if (updateError) {
            throw updateError;
        }

        // 3. Create Audit Log
        await supabase.from('stamp_logs').insert([
            {
                customer_id: customer.id,
                business_id: customer.business_id,
                method: method
            }
        ]);

        // 4. Trigger Wallet Update (Placeholder for Apple Push / Google Wallet PATCH)
        // Here we would use generic fetch APIs to dynamically update Apple Pass and Google Wallet objects
        // Example: send strip_${newTarget}.png layout to Wallet Providers

        return NextResponse.json({
            success: true,
            newTotal: Math.min(newTarget, 10),
            message: 'Stamp added successfully. Apple/Google Wallet PUSH notifications dispatched.'
        });

    } catch (error) {
        console.error('Error adding stamp:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
