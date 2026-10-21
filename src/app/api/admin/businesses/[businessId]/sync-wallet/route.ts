import { NextResponse } from 'next/server';
import { isSuperadmin } from '@/lib/authz';
import { updateWalletTemplate } from '@/lib/wallet/sync-template';

/**
 * Endpoint de sincronización y propagación manual o bajo demanda de plantilla Wallet
 * para un comercio en particular.
 *
 * Envía el PATCH de la LoyaltyClass a Google Wallet y las notificaciones APNs a Apple Wallet.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  if (!await isSuperadmin()) {
    return NextResponse.json({ error: 'No tenés permisos para sincronizar tarjetas de negocios.' }, { status: 403 });
  }

  const { businessId } = await params;

  try {
    const result = await updateWalletTemplate(businessId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API Sync Wallet] Error propagando plantilla Wallet:', error);
    return NextResponse.json(
      { error: error?.message || 'Error al propagar actualización de tarjetas Wallet.' },
      { status: 500 }
    );
  }
}
