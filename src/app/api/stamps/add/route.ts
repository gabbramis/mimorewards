import { NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessBusiness } from "@/lib/authz";
import { scheduleCustomerWalletUpdate } from "@/lib/wallet-notifications";
import { getUruguayMobileVariants } from "@/lib/customer-phone";
import { sendApnsNotification } from "@/lib/wallet/apns";
import { PASS_TYPE_ID } from "@/lib/wallet/appleWallet";
import { getCustomerPushSubscription } from "@/lib/web-push-store";

/**
 * Envía la notificación push silenciosa a APNs para Apple Wallet.
 * Reglas estrictas de Apple Wallet:
 * 1. apns-topic: Debe ser exactamente el passTypeIdentifier del certificado (ej. pass.com.mimorewards.loyalty).
 * 2. payload: Debe ser estrictamente un diccionario aps vacío: { "aps": {} } sin alert ni body.
 */
async function enviarPushAPNs(pushToken: string, passTopic?: string) {
  try {
    const topic = (passTopic || PASS_TYPE_ID).trim();
    console.log(`[enviarPushAPNs] Iniciando push a APNs para token: ${pushToken.slice(0, 10)}... | topic: "${topic}" | payload: {"aps":{}}`);
    return await sendApnsNotification(pushToken, topic);
  } catch (err) {
    console.error(`[APNs] Error al enviar push al token ${pushToken}:`, err);
    return null;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DB_OPERATION_TIMEOUT_MS = 7000;

/**
 * Ejecuta una operación contra la base de datos protegida con un AbortController y timeout estricto.
 * Evita que la ruta quede colgada (hanging) ante conexiones "zombie" o cold starts en Vercel.
 */
async function withDbTimeout<T>(
  operationName: string,
  operation: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs: number = DB_OPERATION_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Timeout en base de datos durante "${operationName}" (${timeoutMs}ms)`));
  }, timeoutMs);

  try {
    return await operation(controller.signal);
  } catch (err: any) {
    console.error(`[stamps/add DB Timeout/Error] Falló "${operationName}":`, err);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const requestController = new AbortController();
  const requestTimeout = setTimeout(() => {
    requestController.abort(new Error("Timeout global en /api/stamps/add"));
  }, 9000);

  try {
    const sessionClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await withDbTimeout("auth.getUser", () => sessionClient.auth.getUser());

    if (authError) {
      console.error("[stamps/add] Error al verificar sesión en Supabase Auth:", authError);
      return NextResponse.json(
        { error: "Error al verificar sesión con la base de datos.", details: authError.message },
        { status: 500 }
      );
    }
    if (!user) {
      return NextResponse.json(
        { error: "Necesitás iniciar sesión para sumar un sello desde el panel." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const identifier = String(body.identifier || body.customerId || body.clientId || "").trim();
    let method = String(body.method || "MANUAL").trim().toUpperCase();
    if (method === "QR_SCAN" || method === "QRSCAN") {
      method = "QR";
    } else if (method === "NFC_SCAN" || method === "NFCSCAN") {
      method = "NFC";
    }
    if (!identifier) return NextResponse.json({ error: "Falta el identificador del cliente." }, { status: 400 });
    if (!["QR", "MANUAL", "NFC"].includes(method)) return NextResponse.json({ error: "Método de sello inválido." }, { status: 400 });

    const supabase: any = createAdminClient();
    const businessId = typeof body.businessId === "string" ? body.businessId.trim() : null;

    const customerResult: any = await withDbTimeout("customers.select", (signal) => {
      let customerQuery = supabase
        .from("customers")
        .select("*")
        .abortSignal(signal)
        .limit(1);

      if (businessId) {
        customerQuery = customerQuery.eq("business_id", businessId);
      }

      if (UUID_PATTERN.test(identifier)) {
        return customerQuery.eq("id", identifier).maybeSingle();
      }

      const variants = getUruguayMobileVariants(identifier);
      if (businessId) {
        let orFilter = `unique_code.eq.${identifier},unique_code.eq.${identifier.replace(/^CLI\s*-\s*/i, "").trim()},phone.eq.${identifier}`;
        for (const v of variants) {
          if (v !== identifier) {
            orFilter += `,phone.eq.${v}`;
          }
        }
        return customerQuery.or(orFilter).maybeSingle();
      }
      return customerQuery.eq("unique_code", identifier).maybeSingle();
    });

    const { data: customer, error: customerError } = customerResult || {};

    if (customerError) {
      console.error("[stamps/add] Error de base de datos al buscar cliente:", customerError);
      return NextResponse.json(
        { error: "Error de base de datos al buscar el cliente.", details: customerError.message },
        { status: 500 }
      );
    }
    if (!customer) {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }

    const hasAccess = await withDbTimeout("canAccessBusiness", () =>
      canAccessBusiness(customer.business_id)
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "No tenés permisos para operar sobre este comercio." }, { status: 403 });
    }

    // 1. Buscar el comercio y la tarjeta activa del cliente
    const { data: business, error: businessError }: any = await withDbTimeout(
      "businesses.select",
      (signal) =>
        supabase
          .from("businesses")
          .select("id, name, active, reward_target, reward_description")
          .abortSignal(signal)
          .eq("id", customer.business_id)
          .maybeSingle()
    );

    if (businessError) {
      console.error("[stamps/add] Error de base de datos al consultar comercio:", businessError);
      return NextResponse.json(
        { error: "Error de base de datos al consultar el comercio.", details: businessError.message },
        { status: 500 }
      );
    }

    if (!business || business.active === false) {
      return NextResponse.json({ error: "El negocio está inactivo." }, { status: 400 });
    }

    // 2. Suma correcta: obtener los sellos actuales de la base de datos y sumar los nuevos sellos (current + nuevos)
    const maxStamps = Number(business.reward_target) || 10;
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

    if (isFull && customer.rewards_available !== undefined && typeof customer.rewards_available === "number") {
      updateCustomerPayload.rewards_available = (customer.rewards_available || 0) + 1;
    }

    // Actualización segura de customers mediante UPDATE con control estricto de errores
    const { error: updateCustomerError }: any = await withDbTimeout(
      "customers.update",
      (signal) =>
        supabase
          .from("customers")
          .update(updateCustomerPayload)
          .abortSignal(signal)
          .eq("id", customer.id)
    );

    if (updateCustomerError) {
      console.error("[stamps/add] Error crítico al actualizar cliente en customers:", updateCustomerError);
      return NextResponse.json(
        { error: "No se pudo actualizar los sellos del cliente en la base de datos.", details: updateCustomerError.message },
        { status: 500 }
      );
    }

    // Actualizar la tarjeta activa en loyalty_cards
    const { data: loyaltyCard, error: loyaltyCardSelectError }: any = await withDbTimeout(
      "loyalty_cards.select",
      (signal) =>
        supabase
          .from("loyalty_cards")
          .select("*")
          .abortSignal(signal)
          .eq("customer_id", customer.id)
          .eq("business_id", customer.business_id)
          .maybeSingle()
    );

    if (loyaltyCardSelectError) {
      console.error("[stamps/add] Error al consultar loyalty_cards:", loyaltyCardSelectError);
      return NextResponse.json(
        { error: "Error al consultar la tarjeta de fidelidad en la base de datos.", details: loyaltyCardSelectError.message },
        { status: 500 }
      );
    }

    if (loyaltyCard) {
      const updateCardPayload: Record<string, any> = {
        current_stamps: newStamps,
        updated_at: now,
      };
      if (isFull && loyaltyCard.rewards_available !== undefined && typeof loyaltyCard.rewards_available === "number") {
        updateCardPayload.rewards_available = (loyaltyCard.rewards_available || 0) + 1;
      }
      const { error: updateCardError }: any = await withDbTimeout(
        "loyalty_cards.update",
        (signal) =>
          supabase
            .from("loyalty_cards")
            .update(updateCardPayload)
            .abortSignal(signal)
            .eq("id", loyaltyCard.id)
      );
      if (updateCardError) {
        console.error("[stamps/add] Error al actualizar loyalty_cards:", updateCardError);
        return NextResponse.json(
          { error: "Error al actualizar la tarjeta de fidelidad.", details: updateCardError.message },
          { status: 500 }
        );
      }
    } else {
      const { error: upsertCardError }: any = await withDbTimeout(
        "loyalty_cards.upsert",
        (signal) =>
          supabase
            .from("loyalty_cards")
            .upsert(
              {
                customer_id: customer.id,
                business_id: customer.business_id,
                current_stamps: newStamps,
                wallet_status: "ACTIVE",
                updated_at: now,
              },
              { onConflict: "customer_id,business_id" }
            )
            .abortSignal(signal)
      );
      if (upsertCardError) {
        console.error("[stamps/add] Error al crear/actualizar loyalty_cards:", upsertCardError);
        return NextResponse.json(
          { error: "Error al sincronizar la tarjeta de fidelidad.", details: upsertCardError.message },
          { status: 500 }
        );
      }
    }

    // Registrar en stamp_logs
    const { error: stampLogError }: any = await withDbTimeout(
      "stamp_logs.insert",
      (signal) =>
        supabase
          .from("stamp_logs")
          .insert({
            customer_id: customer.id,
            business_id: customer.business_id,
            method: method,
            stamps_added: stampsToAdd,
            idempotency_key: request.headers.get("x-idempotency-key") || crypto.randomUUID(),
            metadata: { registered_by_email: user.email || null, registered_by_id: user.id },
          })
          .abortSignal(signal)
    );

    if (stampLogError) {
      console.error("[stamps/add] Error al registrar el movimiento en stamp_logs:", stampLogError);
    }

    // 3. Invalidación de Caché de Next.js justo después de actualizar la base de datos
    try {
      revalidatePath(`/tarjeta/${customer.id}`);
      if (customer.unique_code) {
        revalidatePath(`/tarjeta/${customer.unique_code}`);
      }
      revalidatePath("/tarjeta/[customer_id]", "page");
      revalidatePath("/t/[nfcId]", "page");
    } catch (revalErr) {
      console.warn("[Cache] No se pudo revalidar la ruta de la tarjeta:", revalErr);
    }

    // 4. Aislamiento de Web Push: bloque try/catch independiente para que nunca interrumpa el guardado de sellos
    try {
      const pushSubscription = body.subscription || getCustomerPushSubscription(customer);
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
      const vapidSubject = process.env.VAPID_SUBJECT || "mailto:contacto@tu-dominio.com";

      if (pushSubscription?.endpoint && vapidPublicKey && vapidPrivateKey) {
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title: business.name || "Mimo Rewards",
            body: isFull
              ? `¡Completaste tu tarjeta! Tu premio (${business.reward_description || "Recompensa"}) ya está listo para canjear.`
              : `¡Sumaste ${stampsToAdd === 1 ? "un sello" : `${stampsToAdd} sellos`}! Llevás ${newStamps} de ${maxStamps}.`,
          }),
          { timeout: 4000 }
        );
      }
    } catch (webPushError) {
      console.error("[WebPush] Error enviando notificación push (flujo aislado):", webPushError);
    }

    // 5. Disparador APNs con Delay para Apple Wallet (protegido contra bloqueos)
    let cardId = loyaltyCard?.id;
    let applePushTokens: Array<{ token: string; passType?: string }> = [];
    try {
      if (!cardId) {
        const { data: createdCard }: any = await withDbTimeout(
          "loyalty_cards.selectCreatedId",
          (signal) =>
            supabase
              .from("loyalty_cards")
              .select("id")
              .abortSignal(signal)
              .eq("customer_id", customer.id)
              .eq("business_id", customer.business_id)
              .maybeSingle(),
          3000
        );
        cardId = createdCard?.id;
      }

      const { data: registrations }: any = await withDbTimeout(
        "wallet_registrations.select",
        (signal) => {
          let regQuery = supabase
            .from("wallet_registrations")
            .select("push_token, pass_type_identifier")
            .abortSignal(signal);

          if (cardId) {
            regQuery = regQuery.or(`serial_number.eq.${cardId},customer_id.eq.${customer.id}`);
          } else {
            regQuery = regQuery.eq("customer_id", customer.id);
          }
          return regQuery;
        },
        3000
      );

      const tokenMap = new Map<string, string | undefined>();
      if (registrations) {
        for (const reg of registrations) {
          if (reg.push_token) {
            tokenMap.set(reg.push_token, reg.pass_type_identifier);
          }
        }
      }

      // Fallback a apple_push_token guardado en customers
      if (customer.apple_push_token && !tokenMap.has(customer.apple_push_token)) {
        tokenMap.set(customer.apple_push_token, PASS_TYPE_ID);
      }

      applePushTokens = Array.from(tokenMap.entries()).map(([token, passType]) => ({
        token,
        passType,
      }));

      console.log(`[stamps/add] Cliente: ${customer.first_name} (${customer.unique_code}), Sellos: ${currentStamps} -> ${newStamps}`);
      console.log(`[stamps/add] Apple Wallet tokens encontrados: ${applePushTokens.length}`);
    } catch (tokenErr) {
      console.warn("[APNs] Error al recuperar pushToken de Apple Wallet (no bloqueante):", tokenErr);
    }

    if (applePushTokens.length > 0) {
      let executed = false;
      const dispararPushConDelay = async () => {
        if (executed) return;
        executed = true;
        console.log(`[APNs Delayed Push] Disparando push a los 2s para ${applePushTokens.length} dispositivo(s)...`);
        for (const { token, passType } of applePushTokens) {
          try {
            const res = await enviarPushAPNs(token, passType);
            console.log(`[APNs Delayed Push] Push enviado a ${token.slice(0, 10)}...:`, res?.success ? "OK" : res?.error);
          } catch (err) {
            console.error("[APNs Delayed Push] Falló el envío de push:", err);
          }
        }
      };

      try {
        after(async () => {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await dispararPushConDelay();
        });
      } catch {
        setTimeout(dispararPushConDelay, 2000);
      }
    }

    // Notificar a Google Wallet y fallback a Apple Wallet si no hubo tokens directos
    scheduleCustomerWalletUpdate({
      customerId: customer.id,
      businessId: customer.business_id,
      currentStamps: newStamps,
      targetStamps: maxStamps,
      skipApple: applePushTokens.length > 0,
      notificationMessage: isFull
        ? `¡Tarjeta completada! Ya tenés ${newStamps} de ${maxStamps} sellos para reclamar tu premio.`
        : `¡Sumaste sellos! Llevás ${newStamps} de ${maxStamps}.`,
    });

    return NextResponse.json({
      success: true,
      newTotal: newStamps,
      cycleCompleted: isFull,
      message: isFull
        ? "¡Tarjeta completada! El premio ya está disponible para canjear."
        : "Sello sumado correctamente.",
    });
  } catch (error: any) {
    console.error("[stamps/add] Error crítico al sumar sello:", error);
    const rawError = error?.message || error?.details || (typeof error === "object" ? JSON.stringify(error) : String(error));
    return NextResponse.json({
      error: rawError || "No se pudo sumar el sello.",
      details: error?.details || error?.hint || error?.code || null,
    }, { status: 500 });
  } finally {
    clearTimeout(requestTimeout);
  }
}
