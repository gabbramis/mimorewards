import "server-only";

export type MerchantNotificationType = "success" | "error" | "prize";

export interface MerchantNotificationRecord {
  id: string;
  business_id: string;
  type: MerchantNotificationType;
  message: string;
  is_read: boolean;
  created_at: string;
}

const memoryFallback = new Map<string, MerchantNotificationRecord[]>();

/**
 * Inserta una notificación operativa en `merchant_notifications` en modo "Fire and Forget".
 * Nunca lanza excepciones ni bloquea el flujo principal.
 */
export function logMerchantNotification(
  supabase: any,
  params: {
    businessId: string;
    type: MerchantNotificationType;
    message: string;
  }
): void {
  const { businessId, type, message } = params;
  if (!businessId || !message) return;

  const fallbackRecord: MerchantNotificationRecord = {
    id: crypto.randomUUID(),
    business_id: businessId,
    type,
    message,
    is_read: false,
    created_at: new Date().toISOString(),
  };

  const currentList = memoryFallback.get(businessId) || [];
  memoryFallback.set(businessId, [fallbackRecord, ...currentList].slice(0, 50));

  Promise.resolve(
    supabase.from("merchant_notifications").insert({
      business_id: businessId,
      type,
      message,
      is_read: false,
    })
  )
    .then(({ error }: any) => {
      if (error) {
        console.error("[merchant_notifications] Error insertando notificación en BD:", error.message || error);
      }
    })
    .catch((err: any) => {
      console.error("[merchant_notifications] Fallo inesperado en Fire-and-Forget:", err);
    });
}

export function getFallbackNotifications(businessId: string): MerchantNotificationRecord[] {
  return memoryFallback.get(businessId) || [];
}

export function markFallbackNotificationsRead(businessId: string, notificationId?: string): void {
  const list = memoryFallback.get(businessId);
  if (!list) return;
  memoryFallback.set(
    businessId,
    list.map((item) =>
      !notificationId || item.id === notificationId ? { ...item, is_read: true } : item
    )
  );
}

