import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { patchGoogleWalletLoyaltyClass } from "@/lib/wallet/googleWallet";
import { sendBusinessTemplateUpdatePush } from "@/lib/wallet/apns";

export type WalletTemplateSyncResult = {
  success: boolean;
  businessId: string;
  google: {
    success: boolean;
    classId?: string;
    error?: string;
  };
  apple: {
    devicesFound: number;
    sent: number;
    failed: number;
    configured: boolean;
  };
};

/**
 * Propaga las modificaciones visuales y de configuración de la plantilla de Wallet
 * (colores, logo, banner, emisor y textos de `wallet_config`) a los pases ya instalados
 * en los dispositivos móviles de los clientes de un comercio:
 *
 * 1. GOOGLE WALLET:
 *    - Realiza una llamada PATCH a la LoyaltyClass vinculada (`{issuerId}.{businessId}`).
 *    - Actualiza `hexBackgroundColor`, `heroImage`, `programLogo` e `issuerName`.
 *    - Al actualizar la Class, Google Wallet empuja automáticamente el cambio a todos
 *      los objetos y pases de usuarios vinculados a esa clase.
 *
 * 2. APPLE WALLET:
 *    - Actualiza el campo `updated_at` en `loyalty_cards` para que iOS reconozca el pase
 *      como modificado al consultar `passesUpdatedSince` e `If-Modified-Since`.
 *    - Busca todos los `push_token` asociados a los clientes y pases de ese `business_id`
 *      en `wallet_registrations` (y fallback en `wallet_devices`).
 *    - Envía una notificación push silenciosa `{}` vía APNs a cada dispositivo para que
 *      iOS vuelva a solicitar de inmediato el `.pkpass` actualizado desde el web service.
 *    - Si los certificados APNs no están aún configurados, lo registra en logs y deja la estructura lista.
 */
export async function updateWalletTemplate(businessId: string): Promise<WalletTemplateSyncResult> {
  const supabase: any = createAdminClient();

  const result: WalletTemplateSyncResult = {
    success: false,
    businessId,
    google: { success: false },
    apple: { devicesFound: 0, sent: 0, failed: 0, configured: false },
  };

  try {
    // 1. Obtener los datos actualizados del negocio
    const { data: business, error: bErr } = await supabase
      .from("businesses")
      .select("id, name, logo_url, primary_color, card_text_color, card_accent_color, wallet_config, active")
      .eq("id", businessId)
      .maybeSingle();

    if (bErr || !business) {
      console.error(`[Wallet Template Sync] Negocio ${businessId} no encontrado o error en DB:`, bErr);
      result.google.error = "Negocio no encontrado";
      return result;
    }

    console.log(`[Wallet Template Sync] Iniciando sincronización de plantilla para negocio "${business.name}" (${businessId})...`);

    // 2. Ejecutar la actualización de Google Wallet y Apple Wallet en paralelo
    const [googleRes, appleRes] = await Promise.allSettled([
      patchGoogleWalletLoyaltyClass(business.id, {
        businessName: business.name,
        hexBackgroundColor: business.primary_color,
        logoUrl: business.logo_url,
        walletConfig: business.wallet_config,
      }),
      sendBusinessTemplateUpdatePush(business.id),
    ]);

    if (googleRes.status === "fulfilled") {
      result.google = googleRes.value;
    } else {
      console.error(`[Wallet Template Sync] Excepción al actualizar Google Wallet:`, googleRes.reason);
      result.google = {
        success: false,
        error: googleRes.reason?.message || "Excepción en Google Wallet",
      };
    }

    if (appleRes.status === "fulfilled") {
      result.apple = appleRes.value;
    } else {
      console.error(`[Wallet Template Sync] Excepción al notificar Apple Wallet:`, appleRes.reason);
      result.apple = {
        devicesFound: 0,
        sent: 0,
        failed: 0,
        configured: false,
      };
    }

    // Se considera exitoso a nivel global si al menos una plataforma actualizó o no hubo errores fatales
    result.success = (result.google.success || !result.google.error) && (result.apple.sent > 0 || !result.apple.configured || result.apple.devicesFound === 0);

    console.log(`[Wallet Template Sync] Sincronización finalizada para ${businessId}:`, {
      googleSuccess: result.google.success,
      appleDevices: result.apple.devicesFound,
      appleSent: result.apple.sent,
      appleConfigured: result.apple.configured,
    });

    return result;
  } catch (err: any) {
    console.error(`[Wallet Template Sync] Error inesperado en updateWalletTemplate:`, err);
    result.google.error = err?.message || "Error inesperado";
    return result;
  }
}
