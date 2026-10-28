import "server-only";
import { after } from 'next/server';

import { createAdminClient } from "@/lib/supabase/admin";
import { sendCustomerPassUpdate, sendBusinessCampaignPush } from "@/lib/wallet/apns";
import { updateLoyaltyPoints } from "@/lib/wallet/googleWallet";
import { updateWalletTemplate, type WalletTemplateSyncResult } from "@/lib/wallet/sync-template";

export { updateWalletTemplate, type WalletTemplateSyncResult };


export type CustomerNotificationParams = {
  customerId: string;
  businessId: string;
  currentStamps: number;
  targetStamps?: number;
  notificationMessage?: string;
  businessName?: string;
};

/** Keep provider work alive after responding to the stamp/redeem request. */
export function scheduleCustomerWalletUpdate(params: CustomerNotificationParams) {
  after(async () => {
    try {
      const result = await notifyCustomerWalletUpdate(params);
      console.info('[Wallet Customer Update]', {
        appleAccepted: result.apple.sent,
        appleFailed: result.apple.failed,
        googleUpdated: result.google.success,
        googleNotSaved: result.google.notFound,
        googleFailed: Boolean(result.google.error),
      });
    } catch {
      console.error('[Wallet Notifications] No se pudo completar la actualización de Wallet.');
    }
  });
}

export type CampaignBroadcastParams = {
  businessId: string;
  campaignName: string;
  campaignType: string;
  message: string;
  stampMultiplier?: number;
  expiresAt?: string | null;
  targetChannels?: "all" | "google_only";
};

/**
 * Servicio unificado para notificar y actualizar pases de un cliente en Apple Wallet y Google Wallet
 * Se dispara al sumar sellos o canjear recompensas.
 */
export async function notifyCustomerWalletUpdate(params: CustomerNotificationParams) {
  const { customerId, businessId, currentStamps, targetStamps } = params;
  const supabase: any = createAdminClient();

  const results = {
    apple: { sent: 0, failed: 0 },
    google: { success: false, notFound: false, error: undefined as string | undefined },
  };

  try {
    // 1. Obtener la tarjeta de lealtad y el nombre del comercio si no vino provisto
    const [{ data: cards }, { data: business }] = await Promise.all([
      supabase
        .from("loyalty_cards")
        .select("id, google_wallet_object_id, wallet_platform")
        .eq("customer_id", customerId)
        .eq("business_id", businessId),
      params.businessName
        ? Promise.resolve({ data: { name: params.businessName } })
        : supabase.from("businesses").select("name").eq("id", businessId).maybeSingle(),
    ]);

    const businessName = params.businessName || business?.name || "Mimo Rewards";

    // 2. Notificación y actualización para Apple Wallet (.pkpass + APNs)
    try {
      const appleResult = await sendCustomerPassUpdate(customerId, businessId);
      results.apple = appleResult;
    } catch (appleErr: any) {
      console.error("[Wallet Notifications] Error notifying Apple Wallet:", appleErr?.message);
    }

    // 3. Actualización de saldo de Google Wallet, sin mensajes promocionales.
    if (cards && cards.length > 0) {
      for (const card of cards) {
        if (card.wallet_platform !== 'GOOGLE' && card.wallet_platform !== 'BOTH' && !card.google_wallet_object_id) continue;
        try {
          const gResult = await updateLoyaltyPoints(card.id, currentStamps, {
            targetStamps,
            businessName,
            // Updating balances does not need a promotional message or consume a push quota.
          });

          if (gResult.success) {
            results.google.success = true;
          } else if (gResult.notFound) {
            results.google.notFound = true;
          } else if (gResult.error) {
            results.google.error = gResult.error;
          }
        } catch (gErr: any) {
          console.error("[Wallet Notifications] Error updating Google Wallet card:", card.id, gErr?.message);
          results.google.error = gErr?.message;
        }
      }
    }

    return results;
  } catch (err: any) {
    console.error("[Wallet Notifications] Unexpected error in notifyCustomerWalletUpdate:", err);
    return results;
  }
}

/**
 * No habilitar campañas hasta incorporar consentimiento, destinatarios y cuotas.
 */
export async function broadcastWalletCampaign(_params: CampaignBroadcastParams): Promise<never> {
  throw new Error('Los envíos promocionales están deshabilitados durante el piloto de Wallet.');
}
/**
 * Finaliza la campaña activa de un comercio y regresa el multiplicador a 1
 */
export async function cancelActiveCampaign(businessId: string) {
  const supabase: any = createAdminClient();

  const { error } = await supabase
    .from("businesses")
    .update({
      stamp_multiplier: 1,
      active_campaign_name: null,
      active_campaign_message: null,
      campaign_expires_at: null,
    })
    .eq("id", businessId);

  if (error) {
    console.error("[Wallet Notifications] Error finalizando campaña:", error);
    throw new Error("No se pudo finalizar la campaña.");
  }

  // Notificar a Apple Wallet para que refresque el campo 'latest_notification' del pase
  sendBusinessCampaignPush(businessId).catch((err) => {
    console.warn("[Wallet Notifications] Error enviando push de refresco tras cancelar:", err?.message);
  });

  return { success: true };
}
