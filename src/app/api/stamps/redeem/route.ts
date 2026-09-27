import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canAccessBusiness } from '@/lib/authz';

export async function POST(request: Request) {
    try {
        const sessionClient = await createClient();
        const { data: { user } } = await sessionClient.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Necesitás iniciar sesión para canjear una recompensa.' }, { status: 401 });

        const supabase: any = createAdminClient();
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

        if (!await canAccessBusiness(customer.business_id)) {
            return NextResponse.json({ error: 'No tenés permisos para operar sobre este comercio.' }, { status: 403 });
        }

        const { data, error: redeemError } = await supabase.rpc('redeem_loyalty_reward', {
            p_customer_id: customer.id,
            p_business_id: customer.business_id,
            p_idempotency_key: request.headers.get('x-idempotency-key') || crypto.randomUUID(),
        });
        if (redeemError) throw redeemError;

        const result = Array.isArray(data) ? data[0] : data;
        if (!result?.accepted) {
            const messages: Record<string, string> = {
                insufficient_stamps: 'El cliente todavía no tiene una recompensa disponible.',
                business_inactive: 'El negocio está inactivo.',
                customer_not_found: 'Cliente no encontrado.',
            };
            return NextResponse.json({ error: messages[result?.reason] || 'No se pudo canjear la recompensa.', reason: result?.reason }, { status: 409 });
        }

        return NextResponse.json({ success: true, currentStamps: result.current_stamps, message: result.reason === 'already_processed' ? 'El canje ya estaba registrado.' : 'Recompensa canjeada correctamente.' });

    } catch (error) {
        console.error('Error redeeming stamp:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
