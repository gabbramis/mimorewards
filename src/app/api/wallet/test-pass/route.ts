import { NextResponse } from 'next/server';
import { createOrUpdateLoyaltyClass, generateSavePassUrl } from '@/lib/wallet/googleWallet';

export async function GET() {
    try {
        const businessId = 'demo-local';
        const businessName = 'Mimo Café';
        const hexColor = '#10B981';

        // Create/update the class
        await createOrUpdateLoyaltyClass(businessId, businessName, hexColor);

        // Generate pass
        const cardId = 'demo-card-001';
        const customerName = 'Franco Echichurre';
        const currentStamps = 3;
        const maxStamps = 8;

        const saveUrl = generateSavePassUrl(
            cardId,
            customerName,
            currentStamps,
            maxStamps,
            businessId
        );

        return NextResponse.json({ success: true, saveUrl });
    } catch (error: any) {
        console.error('Wallet Test Pass Error:', error);
        return NextResponse.json(
            { success: false, error: error?.message || 'Error occurred generating the pass' },
            { status: 500 }
        );
    }
}
