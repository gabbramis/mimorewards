import { NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessBusiness } from "@/lib/authz";
import { scheduleCustomerWalletUpdate } from "@/lib/wallet-notifications";
import { normalizeUruguayMobile, cleanUruguayPhone, getUruguayMobileVariants } from "@/lib/customer-phone";
import { sendApnsNotification } from "@/lib/wallet/apns";
import { PASS_TYPE_ID } from "@/lib/wallet/appleWallet";

/**
 * Envía la notificación push silenciosa a APNs para Apple Wallet.
 * Apple Wallet requiere que el payload sea {} y que se use el passTypeIdentifier como topic.
 */
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

export async function POST(request: Request) {
  try {
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Necesitás iniciar sesión para sumar un sello desde el panel." }, { status: 401 });

    const body = await request.json();
    const identifier = String(body.identifier || body.customerId || body.clientId || "").trim();
    let method = String(body.method || "MANUAL").trim().toUpperCase();
    if (method === "QR_SCAN" || method === "QRSCAN") {
      method = "QR";
    } else if (method === "NFC_SCAN" || method === "NFCSCAN") {
      method = "NFC";
    }
    if (!identifier) return NextResponse.json({ error: "Falta el identificador del cliente." }, { status: 400 });
    if (!['QR', 'MANUAL', 'NFC'].includes(method)) return NextResponse.json({ error: "Método de sello inválido." }, { status: 400 });

    const supabase: any = createAdminClient();
    const businessId = typeof body.businessId === "string" ? body.businessId.trim() : null;

    let customerQuery = supabase
      .from("customers")
      .select("*")
      .limit(1);

    if (businessId) {
      customerQuery = customerQuery.eq("business_id", businessId);
    }

    let customerResult;
    if (UUID_PATTERN.test(identifier)) {
      customerResult = await customerQuery.eq("id", identifier).maybeSingle();
    } else {
      const variants = getUruguayMobileVariants(identifier);
      if (businessId) {
        let orFilter = `unique_code.eq.${identifier},unique_code.eq.${identifier.replace(/^CLI\s*-\s*/i, "").trim()},phone.eq.${identifier}`;
        for (const v of variants) {
          if (v !== identifier) {
            orFilter += `,phone.eq.${v}`;
          }
        }
        customerResult = await customerQuery.or(orFilter).maybeSingle();
      } else {
        customerResult = await customerQuery.eq("unique_code", identifier).maybeSingle();
      }
    }
    const { data: customer, error: customerError } = customerResult;

    if (customerError || !customer) return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    if (!await canAccessBusiness(customer.business_id)) {
      return NextResponse.json({ error: "No tenés permisos para operar sobre este comercio." }, { status: 403 });
    }

    // 1. Buscá el comercio y la tarjeta activa del cliente
    const { data: business } = await supabase
      .from("businesses")
      .select("id, active, reward_target, reward_description")
      .eq("id", customer.business_id)
      .maybeSingle();

    if (!business || business.active === false) {
      return NextResponse.json({ error: "El negocio está inactivo." }, { status: 400 });
    }

    const maxStamps = Number(business.reward_target) || 10;
    const currentStamps = Number(customer.current_stamps) || 0;

    // 2. Si stamps < max_stamps: sumá stamps + 1.
    // 3. Si stamps === max_stamps (la tarjeta estaba llena):
    //    - Reseteá stamps a 1 (comenzando el nuevo ciclo con el sello recién escaneado).
    //    - (Opcional/Recomendado) Sumá +1 a un contador de rewards_available si existe esa columna.
    const isFull = currentStamps >= maxStamps;
    const newStamps = isFull ? 1 : currentStamps + 1;

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

    // Actualización segura de customers mediante UPDATE (sin crear registros duplicados)
    const { error: updateCustomerError } = await supabase
      .from("customers")
      .update(updateCustomerPayload)
      .eq("id", customer.id);

    if (updateCustomerError) {
      console.error("Error al actualizar cliente en customers:", updateCustomerError);
      throw updateCustomerError;
    }

    // Actualizar la tarjeta activa en loyalty_cards
    const { data: loyaltyCard } = await supabase
      .from("loyalty_cards")
      .select("*")
      .eq("customer_id", customer.id)
      .eq("business_id", customer.business_id)
      .maybeSingle();

    if (loyaltyCard) {
      const updateCardPayload: Record<string, any> = {
        current_stamps: newStamps,
        updated_at: now,
      };
      if (isFull && loyaltyCard.rewards_available !== undefined && typeof loyaltyCard.rewards_available === "number") {
        updateCardPayload.rewards_available = (loyaltyCard.rewards_available || 0) + 1;
      }
      await supabase
        .from("loyalty_cards")
        .update(updateCardPayload)
        .eq("id", loyaltyCard.id);
    } else {
      await supabase
        .from("loyalty_cards")
        .upsert({
          customer_id: customer.id,
          business_id: customer.business_id,
          current_stamps: newStamps,
          wallet_status: "ACTIVE",
          updated_at: now,
        }, { onConflict: "customer_id,business_id" });
    }

    // Registrar en stamp_logs
    await supabase.from("stamp_logs").insert({
      customer_id: customer.id,
      business_id: customer.business_id,
      method: method,
      stamps_added: 1,
      idempotency_key: request.headers.get("x-idempotency-key") || crypto.randomUUID(),
      metadata: { registered_by_email: user.email || null, registered_by_id: user.id },
    });

    // 2. Disparador APNs con Delay: Apenas la base de datos confirme el guardado,
    // recuperar el pushToken del dispositivo del cliente
    let cardId = loyaltyCard?.id;
    if (!cardId) {
      const { data: createdCard } = await supabase
        .from("loyalty_cards")
        .select("id")
        .eq("customer_id", customer.id)
        .eq("business_id", customer.business_id)
        .maybeSingle();
      cardId = createdCard?.id;
    }

    let applePushTokens: Array<{ token: string; passType?: string }> = [];
    try {
      let regQuery = supabase
        .from("wallet_registrations")
        .select("push_token, pass_type_identifier");

      if (cardId) {
        regQuery = regQuery.or(`serial_number.eq.${cardId},customer_id.eq.${customer.id}`);
      } else {
        regQuery = regQuery.eq("customer_id", customer.id);
      }

      const { data: registrations } = await regQuery;

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

      // Fallback por todas las tarjetas del cliente
      if (tokenMap.size === 0) {
        const { data: allCards } = await supabase
          .from("loyalty_cards")
          .select("id")
          .eq("customer_id", customer.id);
        const cardIds = (allCards || []).map((c: any) => c.id);
        if (cardIds.length > 0) {
          const { data: regByCards } = await supabase
            .from("wallet_registrations")
            .select("push_token, pass_type_identifier")
            .in("serial_number", cardIds);
          (regByCards || []).forEach((r: any) => {
            if (r.push_token) tokenMap.set(r.push_token, r.pass_type_identifier);
          });
        }
      }

      applePushTokens = Array.from(tokenMap.entries()).map(([token, passType]) => ({
        token,
        passType,
      }));

      console.log(`[stamps/add] Cliente: ${customer.first_name} (${customer.unique_code}), Sellos: ${currentStamps} -> ${newStamps}`);
      console.log(`[stamps/add] Apple Wallet tokens encontrados: ${applePushTokens.length}`);
      if (applePushTokens.length === 0) {
        console.warn("[stamps/add] No se encontraron tokens de Apple Wallet para este cliente. Asegurate de que la tarjeta esté instalada en el dispositivo.");
      }
    } catch (tokenErr) {
      console.warn("[APNs] Error al recuperar pushToken de Apple Wallet:", tokenErr);
    }

    // 3. Efecto diferido: Disparar la notificación push a los servidores de APNs
    // de forma asíncrona a los 2 segundos exactos, sin bloquear la respuesta 200 OK del cajero.
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

      // Disparar vía setTimeout a los 2 segundos exactos
      setTimeout(dispararPushConDelay, 2000);

      // Compatibilidad serverless: after() garantiza tiempo de ejecución sin pausar el hilo ni demorar el 200 OK
      try {
        after(async () => {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          await dispararPushConDelay();
        });
      } catch {
        // Fallback a setTimeout en entornos donde after() no esté disponible
      }
    }

    // Notificar a Google Wallet y fallback a Apple Wallet si no hubo tokens directos
    // skipApple: true evita push inmediato duplicado ya que se programó a los 2s
    scheduleCustomerWalletUpdate({
      customerId: customer.id,
      businessId: customer.business_id,
      currentStamps: newStamps,
      targetStamps: maxStamps,
      skipApple: applePushTokens.length > 0,
      notificationMessage: isFull
        ? `¡Tarjeta completada! Comenzaste un nuevo ciclo con 1 de ${maxStamps} sellos.`
        : `¡Sumaste sellos! Llevás ${newStamps} de ${maxStamps}.`,
    });

    return NextResponse.json({
      success: true,
      newTotal: newStamps,
      cycleCompleted: isFull,
      message: isFull
        ? "¡Tarjeta completada! Comenzó un nuevo ciclo con 1 sello."
        : "Sello sumado correctamente.",
    });
  } catch (error: any) {
    console.error("Error adding stamp:", error);
    const rawError = error?.message || error?.details || (typeof error === "object" ? JSON.stringify(error) : String(error));
    return NextResponse.json({
      error: rawError || "No se pudo sumar el sello.",
      details: error?.details || error?.hint || error?.code || null,
    }, { status: 500 });
  }
}
