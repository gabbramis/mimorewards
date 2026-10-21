import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendCustomerPassUpdate, sendBusinessCampaignPush } from "@/lib/wallet/apns";
import {
  updateLoyaltyPoints,
  broadcastGoogleWalletClassMessage,
  getGoogleClassId,
} from "@/lib/wallet/googleWallet";
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
  const { customerId, businessId, currentStamps, targetStamps, notificationMessage } = params;
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

    // 3. Notificación y actualización para Google Wallet (PATCH + TEXT_AND_NOTIFY)
    if (cards && cards.length > 0) {
      for (const card of cards) {
        try {
          const defaultMsg = notificationMessage || `¡Sumaste sellos! Llevás ${currentStamps}${targetStamps ? ` de ${targetStamps}` : ""} en ${businessName}.`;
          const gResult = await updateLoyaltyPoints(card.id, currentStamps, {
            targetStamps,
            businessName,
            notificationMessage: defaultMsg,
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
 * Servicio unificado para transmitir campañas y notificaciones push simultáneas a Apple Wallet y Google Wallet
 * Actualiza la campaña activa del comercio y registra el envío en push_campaigns_log.
 */
export async function broadcastWalletCampaign(params: CampaignBroadcastParams) {
  const { businessId, campaignName, campaignType, message, stampMultiplier = 1, expiresAt } = params;
  const supabase: any = createAdminClient();

  // 1. Obtener comercio
  const { data: business, error: bError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .maybeSingle();

  if (bError || !business) {
    throw new Error("Comercio no encontrado.");
  }

  // 2. Actualizar configuración de campaña en la tabla businesses
  const { error: updateError } = await supabase
    .from("businesses")
    .update({
      active_campaign_name: campaignName,
      active_campaign_message: message,
      stamp_multiplier: stampMultiplier,
      campaign_expires_at: expiresAt || null,
    })
    .eq("id", businessId);

  if (updateError) {
    console.error("[Wallet Notifications] Error actualizando businesses:", updateError);
    throw new Error("No se pudo activar la campaña en la base de datos.");
  }

  // 3. Disparo masivo a Apple Wallet vía APNs (notifica a todos los dispositivos registrados en wallet_registrations)
  let appleSent = 0;
  if (params.targetChannels !== "google_only") {
    try {
      const applePush = await sendBusinessCampaignPush(businessId);
      appleSent = applePush.sent;
    } catch (appleErr: any) {
      console.error("[Wallet Notifications] Fallo enviando push APNs:", appleErr?.message);
    }
  }

  // 4. Disparo masivo a Google Wallet (LoyaltyClass.addMessage con TEXT_AND_NOTIFY)
  let googleSent = 0;
  try {
    // Contar usuarios que tienen Google Wallet vinculado
    const { count } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .or("wallet_platform.eq.GOOGLE,wallet_platform.eq.BOTH,google_wallet_object_id.not.is.null,google_object_id.not.is.null");

    googleSent = count || 0;

    const gResult = await broadcastGoogleWalletClassMessage(
      businessId,
      campaignName || business.name,
      message
    );

    if (!gResult.success) {
      console.warn("[Wallet Notifications] Falló broadcast a Google Wallet class:", gResult.error);
    }
  } catch (googleErr: any) {
    console.error("[Wallet Notifications] Fallo broadcast Google Wallet:", googleErr?.message);
  }

  // 5. Registrar en push_campaigns_log
  try {
    await supabase.from("push_campaigns_log").insert({
      business_id: businessId,
      campaign_type: campaignType,
      message,
      apple_devices_notified: appleSent,
      google_passes_notified: googleSent,
    });
  } catch (logErr: any) {
    console.error("[Wallet Notifications] Error insertando en push_campaigns_log:", logErr);
  }

  return {
    success: true,
    campaignName,
    appleSent,
    googleSent,
  };
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
