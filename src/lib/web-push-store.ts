import "server-only";
import type { PushSubscription } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Almacén en memoria como respaldo en caso de que la columna push_subscription aún no exista en Supabase
const memorySubscriptions = new Map<string, PushSubscription>();

export async function saveCustomerPushSubscription(
  customerId: string | undefined,
  subscription: PushSubscription
): Promise<void> {
  if (!customerId || !subscription?.endpoint) return;

  memorySubscriptions.set(customerId, subscription);

  try {
    const supabase: any = createAdminClient();
    await supabase
      .from("customers")
      .update({
        push_subscription: subscription,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);
  } catch (err) {
    console.warn("[WebPush Store] No se pudo persistir push_subscription en DB (usando memoria):", err);
  }
}

export function getCustomerPushSubscription(customer: any): PushSubscription | null {
  if (!customer) return null;

  const raw =
    customer.push_subscription ||
    customer.web_push_subscription ||
    (customer.id ? memorySubscriptions.get(customer.id) : null);

  if (!raw) return null;

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed?.endpoint && parsed?.keys?.p256dh && parsed?.keys?.auth) {
      return parsed as PushSubscription;
    }
  } catch {
    return null;
  }

  return null;
}

