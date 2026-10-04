import { NextResponse } from 'next/server';
import { updateLoyaltyPoints } from '@/lib/wallet/googleWallet';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { cardId, currentStamps } = body;

        if (!cardId || typeof currentStamps !== 'number') {
            return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
        }

        await updateLoyaltyPoints(cardId, currentStamps);

        return NextResponse.json({ success: true, updatedStamps: currentStamps });
    } catch (error: any) {
        console.error('Simulate Stamp Error:', error);
        return NextResponse.json(
            { success: false, error: error?.message || 'Error updating stamps' },
            { status: 500 }
        );
    }
}
