import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUruguayMobileVariants } from "@/lib/customer-phone";
import { getCustomerPushSubscription } from "@/lib/web-push-store";
import { scheduleCustomerWalletUpdate } from "@/lib/wallet-notifications";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DB_TIMEOUT_MS = 5000;

export async function POST(request: Request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error("Timeout de base de datos (5000ms)"));
  }, DB_TIMEOUT_MS);

  try {
    const body = await request.json();
    const identifier = String(body.identifier || body.customerId || body.clientId || "").trim();
    const businessId = typeof body.businessId === "string" ? body.businessId.trim() : null;

    let method = String(body.method || "MANUAL").trim().toUpperCase();
    if (method === "QR_SCAN" || method === "QRSCAN") method = "QR";
    else if (method === "NFC_SCAN" || method === "NFCSCAN") method = "NFC";

    if (!identifier) {
      return NextResponse.json({ error: "Falta el identificador del cliente." }, { status: 400 });
    }
    if (!["QR", "MANUAL", "NFC"].includes(method)) {
      return NextResponse.json({ error: "Método de sello inválido." }, { status: 400 });
    }

    const supabase: any = createAdminClient();

    // 1. Consulta única (Cliente + Comercio en un solo roundtrip, sin waterfall)
    let customerQuery = supabase
      .from("customers")
      .select("*, businesses(id, name, active, reward_target, reward_description)")
      .abortSignal(controller.signal)
      .limit(1);

    if (businessId) {
      customerQuery = customerQuery.eq("business_id", businessId);
    }

    if (UUID_PATTERN.test(identifier)) {
      customerQuery = customerQuery.eq("id", identifier);
    } else {
      const cleanCode = identifier.replace(/^CLI\s*-\s*/i, "").trim();
      const variants = getUruguayMobileVariants(identifier);
      if (businessId) {
        let orFilter = `unique_code.eq.${identifier},unique_code.eq.${cleanCode},phone.eq.${identifier}`;
        for (const v of variants) {
          if (v !== identifier) orFilter += `,phone.eq.${v}`;
        }
        customerQuery = customerQuery.or(orFilter);
      } else {
        customerQuery = customerQuery.or(`unique_code.eq.${identifier},unique_code.eq.${cleanCode}`);
      }
    }

    const { data: customer, error: customerError } = await customerQuery.maybeSingle();

    if (customerError) {
      console.error("[stamps/add] Error de lectura en BD:", customerError);
      return NextResponse.json(
        { error: "Error de conexión con la base de datos.", details: customerError.message },
        { status: 500 }
      );
    }

    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const business = Array.isArray(customer.businesses)
      ? customer.businesses[0]
      : customer.businesses;

    if (business && business.active === false) {
      return NextResponse.json({ error: "El negocio está inactivo." }, { status: 400 });
    }

    // 2. Cálculo directo de sellos (current + nuevos)
    const maxStamps = Number(business?.reward_target) || 10;
    const currentStamps = Number(customer.current_stamps) || 0;
    const stampsToAdd = Math.max(
      1,
      Math.floor(Number(body.stamps ?? body.stampsToAdd ?? body.nuevos ?? 1) || 1)
    );
    const newStamps = currentStamps + stampsToAdd;
    const isFull = newStamps >= maxStamps;
    const now = new Date().toISOString();

    const updateCustomerPayload: Record<string, any> = {
      current_stamps: newStamps,
      total_visits: (Number(customer.total_visits) || 0) + 1,
      last_visit_at: now,
      updated_at: now,
    };

    if (isFull && typeof customer.rewards_available === "number") {
      updateCustomerPayload.rewards_available = (customer.rewards_available || 0) + 1;
    }

    // 3. Guardado prioritario en la base de datos
    const { error: updateError } = await supabase
      .from("customers")
      .update(updateCustomerPayload)
      .abortSignal(controller.signal)
      .eq("id", customer.id);

    if (updateError) {
      console.error("[stamps/add] Error al guardar sellos en BD:", updateError);
      return NextResponse.json(
        { error: "No se pudo guardar el sello en la base de datos.", details: updateError.message },
        { status: 500 }
      );
    }

    // Liberamos el timer del lectura/escritura principal apenas confirma la BD
    clearTimeout(timeoutId);

    // 4. Invalidación inmediata de caché de la tarjeta
    try {
      revalidatePath(`/tarjeta/${customer.id}`);
      if (customer.unique_code) {
        revalidatePath(`/tarjeta/${customer.unique_code}`);
      }
      revalidatePath("/tarjeta/[customer_id]", "page");
      revalidatePath("/t/[nfcId]", "page");
    } catch (revalErr) {
      console.error("[stamps/add] Error en revalidatePath:", revalErr);
    }

    // 5. "Fire and Forget" para Web Push y tareas secundarias (SIN await que bloquee la respuesta)
    const pushSubscription = body.subscription || getCustomerPushSubscription(customer);
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || "mailto:contacto@tu-dominio.com";

    if (pushSubscription?.endpoint && vapidPublicKey && vapidPrivateKey) {
      try {
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
        webpush
          .sendNotification(
            pushSubscription,
            JSON.stringify({
              title: business?.name || "Mimo Rewards",
              body: isFull
                ? `¡Completaste tu tarjeta! Tu premio (${business?.reward_description || "Recompensa"}) ya está listo para canjear.`
                : `¡Sumaste ${stampsToAdd === 1 ? "un sello" : `${stampsToAdd} sellos`}! Llevás ${newStamps} de ${maxStamps}.`,
            }),
            { timeout: 4000 }
          )
          .catch((pushErr) => {
            console.error("[WebPush Fire-and-Forget] Falló el envío de notificación:", pushErr);
          });
      } catch (syncPushErr) {
        console.error("[WebPush Fire-and-Forget] Error al preparar notificación:", syncPushErr);
      }
    }

    // Sincronización secundaria en segundo plano (logs y tarjetas de wallet) sin bloquear respuesta HTTP
    void Promise.allSettled([
      supabase.from("loyalty_cards").upsert(
        {
          customer_id: customer.id,
          business_id: customer.business_id,
          current_stamps: newStamps,
          wallet_status: "ACTIVE",
          updated_at: now,
        },
        { onConflict: "customer_id,business_id" }
      ),
      supabase.from("stamp_logs").insert({
        customer_id: customer.id,
        business_id: customer.business_id,
        method,
        stamps_added: stampsToAdd,
        idempotency_key: request.headers.get("x-idempotency-key") || crypto.randomUUID(),
      }),
    ]).catch((bgErr) => {
      console.error("[stamps/add Background Sync] Error en tablas secundarias:", bgErr);
    });

    try {
      scheduleCustomerWalletUpdate({
        customerId: customer.id,
        businessId: customer.business_id,
        currentStamps: newStamps,
        targetStamps: maxStamps,
        businessName: business?.name,
        notificationMessage: isFull
          ? `¡Tarjeta completada! Ya tenés ${newStamps} de ${maxStamps} sellos para reclamar tu premio.`
          : `¡Sumaste sellos! Llevás ${newStamps} de ${maxStamps}.`,
      });
    } catch (walletErr) {
      console.error("[Wallet Fire-and-Forget] Error programando actualización:", walletErr);
    }

    // 6. Retorno inmediato al frontend (status 200)
    return NextResponse.json(
      {
        success: true,
        newTotal: newStamps,
        cycleCompleted: isFull,
        message: isFull
          ? "¡Tarjeta completada! El premio ya está disponible para canjear."
          : "Sello sumado correctamente.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[stamps/add] Error crítico o timeout en el endpoint:", error);
    return NextResponse.json(
      {
        error: "La base de datos tardó demasiado en responder o falló la operación. Intentá de nuevo.",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
