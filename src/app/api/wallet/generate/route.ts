import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createOrUpdateLoyaltyClass, generateSavePassUrl } from '@/lib/wallet/googleWallet';

export async function POST(request: Request) {
    try {
        const { customerId } = await request.json();

        if (!customerId) {
            return NextResponse.json({ success: false, error: 'Customer ID is required' }, { status: 400 });
        }

        const supabase: any = createAdminClient();

        // 1. Fetch customer details
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select(`
                id,
                first_name,
                last_name,
                business_id,
                current_stamps
            `)
            .eq('id', customerId)
            .single();

        if (customerError || !customer) {
            return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
        }

        // 2. Fetch business details
        const { data: business, error: businessError } = await supabase
            .from('businesses')
            .select('id, name, logo_url, reward_target')
            .eq('id', customer.business_id)
            .single();

        if (businessError || !business) {
            return NextResponse.json({ success: false, error: 'Business not found' }, { status: 404 });
        }

        // 3. Fetch loyalty card ID (required to map the token)
        const { data: loyaltyCard, error: cardError } = await supabase
            .from('loyalty_cards')
            .select('id')
            .eq('customer_id', customer.id)
            .eq('business_id', business.id)
            .single();

        if (cardError || !loyaltyCard) {
            return NextResponse.json({ success: false, error: 'Loyalty card not found' }, { status: 404 });
        }

        const fullName = `${customer.first_name} ${customer.last_name || ''}`.trim();
        const hexColor = '#10B981'; // Default, we could pull from business styling later if added

        // 4. Create/update class in Google Wallet
        await createOrUpdateLoyaltyClass(business.id, business.name, hexColor, business.logo_url);

        // 5. Generate and return the Save URL
        const saveUrl = generateSavePassUrl(
            loyaltyCard.id,
            fullName,
            customer.current_stamps,
            business.reward_target,
            business.id
        );

        return NextResponse.json({ success: true, saveUrl });

    } catch (error: any) {
        console.error('Wallet Save Generation Error:', error);
        return NextResponse.json(
            { success: false, error: error?.message || 'Error occurred generating the pass' },
            { status: 500 }
        );
    }
}
