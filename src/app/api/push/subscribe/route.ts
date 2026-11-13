import { NextResponse } from "next/server";
import type { PushSubscription } from "web-push";
import { saveCustomerPushSubscription } from "@/lib/web-push-store";

type SubscribeBody = {
  subscription?: PushSubscriptionJSON;
  customerId?: string;
  businessId?: string;
} & Partial<PushSubscriptionJSON>;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SubscribeBody;
    // Acepta { subscription, customerId, businessId } o la suscripción "plana" (formato anterior).
    const subscription = body.subscription ?? (body.endpoint ? body : null);

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { success: false, error: "Suscripción inválida" },
        { status: 400 }
      );
    }

    await saveCustomerPushSubscription(body.customerId, subscription as PushSubscription);

    console.log("[Push Notification] Nueva suscripción registrada", {
      customerId: body.customerId ?? null,
      businessId: body.businessId ?? null,
    });

    return NextResponse.json(
      { success: true, message: "Suscripción recibida" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Push Notification] Error al procesar suscripción:", error);
    return NextResponse.json(
      { success: false, error: "Error al procesar la suscripción" },
      { status: 400 }
    );
  }
}
