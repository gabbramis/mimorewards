import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerPushSubscription } from "@/lib/web-push-store";
import { scheduleCustomerWalletUpdate } from "@/lib/wallet-notifications";
import { logMerchantNotification } from "@/lib/merchant-notifications-store";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DB_TIMEOUT_MS = 5000;

export async function POST(request: Request) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error("Timeout de base de datos (5000ms)"));
  }, DB_TIMEOUT_MS);

  let currentBusinessId = "";
  let supabaseRef: any = null;

  try {
    const body = await request.json();
    const identifier = String(body.identifier || body.customerId || body.clientId || "").trim();
    currentBusinessId = typeof body.businessId === "string" ? body.businessId.trim() : "";

    let method = String(body.method || "MANUAL").trim().toUpperCase();
    if (method === "QR_SCAN" || method === "QRSCAN") method = "QR";
    else if (method === "NFC_SCAN" || method === "NFCSCAN") method = "NFC";

    if (!identifier) {
      return NextResponse.json({ error: "Falta el identificador del cliente." }, { status: 400 });
    }
    if (!currentBusinessId) {
      return NextResponse.json(
        { error: "Falta el businessId del comercio para identificar al cliente." },
        { status: 400 }
      );
    }
    if (!["QR", "MANUAL", "NFC"].includes(method)) {
      return NextResponse.json({ error: "Método de sello inválido." }, { status: 400 });
    }

    const supabase: any = createAdminClient();
    supabaseRef = supabase;

    // 1. Búsqueda estricta del cliente dentro del comercio autenticado (currentBusinessId)
    let customerQuery = supabase
      .from("customers")
      .select("*")
      .abortSignal(controller.signal);

    if (UUID_PATTERN.test(identifier)) {
      customerQuery = customerQuery
        .eq("id", identifier)
        .eq("business_id", currentBusinessId);
    } else {
      const scannedCode = identifier.replace(/^CLI\s*-\s*/i, "").trim();
      customerQuery = customerQuery
        .eq("unique_code", scannedCode)
        .eq("business_id", currentBusinessId);
    }

    const [customerRes, preloadedBusinessRes] = await Promise.all([
      customerQuery.maybeSingle(),
      supabase
        .from("businesses")
        .select("id, name, active, reward_target, reward_description")
        .abortSignal(controller.signal)
        .eq("id", currentBusinessId)
        .maybeSingle(),
    ]);

    const { data: customer, error: customerError } = customerRes;

    if (customerError) {
      console.error("[stamps/add] Error de lectura en BD (customers):", customerError);
      logMerchantNotification(supabase, {
        businessId: currentBusinessId,
        type: "error",
        message: `Fallo al procesar: ${customerError.message || "Error de conexión con la base de datos"}`,
      });
      return NextResponse.json(
        { error: "Error de conexión con la base de datos.", details: customerError.message },
        { status: 500 }
      );
    }

    if (!customer) {
      logMerchantNotification(supabase, {
        businessId: currentBusinessId,
        type: "error",
        message: `Fallo al procesar: Cliente no encontrado (${identifier})`,
      });
      return NextResponse.json(
        { error: "Cliente no encontrado en este comercio." },
        { status: 404 }
      );
    }

    const cardBusinessId: string = currentBusinessId;

    // Lectura en paralelo: comercio (si no vino precargado) + registro por comercio en loyalty_cards
    const [businessRes, cardRes] = await Promise.all([
      preloadedBusinessRes.data
        ? Promise.resolve(preloadedBusinessRes)
        : supabase
            .from("businesses")
            .select("id, name, active, reward_target, reward_description")
            .abortSignal(controller.signal)
            .eq("id", cardBusinessId)
            .maybeSingle(),
      supabase
        .from("loyalty_cards")
        .select("id, current_stamps")
        .abortSignal(controller.signal)
        .eq("customer_id", customer.id)
        .eq("business_id", cardBusinessId)
        .maybeSingle(),
    ]);

    if (businessRes.error) {
      console.error("[stamps/add] Error de lectura en BD (businesses):", businessRes.error);
    }
    if (cardRes.error) {
      console.error("[stamps/add] Error de lectura en BD (loyalty_cards):", cardRes.error);
    }

    const business = businessRes.data;
    const existingCard = cardRes.data; // null => cliente nuevo en este comercio

    if (business && business.active === false) {
      return NextResponse.json({ error: "El negocio está inactivo." }, { status: 400 });
    }

    // 2. Cálculo de sellos con fallback estricto para null/undefined (cliente nuevo => 0)
    const maxStamps = Number(business?.reward_target) || 10;
    const currentStamps = Number(customer?.current_stamps ?? existingCard?.current_stamps) || 0;
    const stampsToAdd = Math.max(
      1,
      Math.floor(Number(body.stamps ?? body.stampsToAdd ?? body.nuevos ?? 1) || 1)
    );
    const rawNewStamps = currentStamps + stampsToAdd;
    const prizeTriggered = rawNewStamps >= maxStamps;
    // Persistimos siempre el impacto del último sello (ej. 6/6 o 10/10)
    let persistedStamps = Math.min(rawNewStamps, maxStamps);
    const now = new Date().toISOString();

    // 3. Escritura prioritaria: UPDATE del cliente + INSERT/UPDATE (upsert) del registro por comercio
    const writeCard = () =>
      existingCard
        ? supabase
            .from("loyalty_cards")
            .update({ current_stamps: persistedStamps, updated_at: now })
            .abortSignal(controller.signal)
            .eq("id", existingCard.id)
        : supabase
            .from("loyalty_cards")
            .upsert(
              {
                customer_id: customer.id,
                business_id: cardBusinessId,
                current_stamps: persistedStamps, // inicializa con la cantidad entrante
                wallet_status: "ACTIVE",
                updated_at: now,
              },
              { onConflict: "customer_id,business_id" }
            )
            .abortSignal(controller.signal);

    const [customerWrite, cardWrite] = await Promise.all([
      supabase
        .from("customers")
        .update({
          current_stamps: persistedStamps,
          total_visits: (Number(customer.total_visits) || 0) + 1,
          last_visit_at: now,
          updated_at: now,
        })
        .abortSignal(controller.signal)
        .eq("id", customer.id),
      writeCard(),
    ]);

    if (customerWrite.error) {
      console.error("[stamps/add] Error al guardar sellos en BD (customers):", customerWrite.error);
      logMerchantNotification(supabase, {
        businessId: cardBusinessId,
        type: "error",
        message: `Fallo al procesar: ${customerWrite.error.message || "No se pudo guardar el sello"}`,
      });
      return NextResponse.json(
        { error: "No se pudo guardar el sello en la base de datos.", details: customerWrite.error.message },
        { status: 500 }
      );
    }

    if (cardWrite.error) {
      // El sello ya quedó guardado en customers; la tarjeta se reintentará en el próximo sello.
      console.error(
        `[stamps/add] Error al ${existingCard ? "actualizar" : "crear"} loyalty_cards:`,
        cardWrite.error
      );
    }

    // 4. Aislamiento del Premio (Try/Catch interno para condición de "Tarjeta Llena")
    // Si la suma de sellos alcanza o supera el límite de la tarjeta, intentamos registrar el premio
    // sin que ningún error de constraint en Supabase interrumpa la ruta ni pierda el último sello.
    if (prizeTriggered) {
      try {
        // Si ya estaba llena en un ciclo anterior (ej. 6/6 y suma otro) o se solicita auto-reset explícito
        if (body.resetCounter === true || currentStamps >= maxStamps) {
          const resetValue = currentStamps >= maxStamps ? stampsToAdd : 0;
          const [{ error: resetErr }] = await Promise.all([
            supabase
              .from("customers")
              .update({ current_stamps: resetValue, updated_at: now })
              .abortSignal(controller.signal)
              .eq("id", customer.id),
            supabase
              .from("loyalty_cards")
              .update({ current_stamps: resetValue, updated_at: now })
              .abortSignal(controller.signal)
              .eq("customer_id", customer.id)
              .eq("business_id", cardBusinessId),
          ]);

          if (resetErr) {
            console.error("[stamps/add Prize Reset Error] No se pudo resetear el contador:", resetErr);
          } else {
            persistedStamps = resetValue;
          }
        }

        // Registrar el premio/cupón en segundo plano o dentro del bloque aislado
        if ("rewards_available" in customer) {
          const { error: rewardCounterErr } = await supabase
            .from("customers")
            .update({
              rewards_available: (Number(customer.rewards_available) || 0) + 1,
            })
            .eq("id", customer.id);

          if (rewardCounterErr) {
            console.error("[stamps/add Prize Error] Error actualizando rewards_available:", rewardCounterErr);
          }
        }
      } catch (prizeError) {
        console.error(
          "[stamps/add Prize Error] Falló la lógica exclusiva de tarjeta llena (el sello sí fue guardado):",
          prizeError
        );
      }
    }

    // Liberamos el timer de base de datos apenas se confirma el guardado
    clearTimeout(timeoutId);

    // 5. Invalidación inmediata de caché de la tarjeta
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

    // 6. Promesas en Segundo Plano ("Fire and Forget") para Push normal y Push de "¡Ganaste un premio!"
    const pushSubscription = body.subscription || getCustomerPushSubscription(customer);
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || "mailto:contacto@tu-dominio.com";

    if (pushSubscription?.endpoint && vapidPublicKey && vapidPrivateKey) {
      try {
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
        const pushPayload = JSON.stringify({
          title: prizeTriggered
            ? `🎉 ¡Ganaste un premio en ${business?.name || "Mimo Rewards"}!`
            : business?.name || "Mimo Rewards",
          body: prizeTriggered
            ? `¡Completaste tus ${maxStamps}/${maxStamps} sellos! Tu premio (${business?.reward_description || "Recompensa"}) ya está listo para canjear.`
            : `¡Sumaste ${stampsToAdd === 1 ? "un sello" : `${stampsToAdd} sellos`}! Llevás ${persistedStamps} de ${maxStamps}.`,
        });

        // Ejecución estrictamente Fire-and-Forget (sin await bloqueante)
        webpush
          .sendNotification(pushSubscription, pushPayload, { timeout: 4000 })
          .catch((pushErr) => {
            console.error("[WebPush Fire-and-Forget] Falló el envío de notificación:", pushErr);
          });
      } catch (syncPushErr) {
        console.error("[WebPush Fire-and-Forget] Error al preparar notificación:", syncPushErr);
      }
    }

    // 6.1 Inserción asíncrona ("Fire and Forget") en merchant_notifications
    const cleanUniqueCode = String(customer.unique_code || identifier).replace(/^CLI\s*-\s*/i, "").trim();
    if (prizeTriggered) {
      logMerchantNotification(supabase, {
        businessId: cardBusinessId,
        type: "prize",
        message: `¡Premio alcanzado por el cliente #${cleanUniqueCode}!`,
      });
    } else {
      logMerchantNotification(supabase, {
        businessId: cardBusinessId,
        type: "success",
        message: `Se sumó ${stampsToAdd} sello(s) al cliente #${cleanUniqueCode}`,
      });
    }

    // Registro del movimiento en segundo plano (la tarjeta ya se escribió arriba)
    void Promise.allSettled([
      supabase.from("stamp_logs").insert({
        customer_id: customer.id,
        business_id: cardBusinessId,
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
        currentStamps: persistedStamps,
        targetStamps: maxStamps,
        businessName: business?.name,
        notificationMessage: prizeTriggered
          ? `¡Ganaste un premio! Completaste ${maxStamps} de ${maxStamps} sellos.`
          : `¡Sumaste sellos! Llevás ${persistedStamps} de ${maxStamps}.`,
      });
    } catch (walletErr) {
      console.error("[Wallet Fire-and-Forget] Error programando actualización:", walletErr);
    }

    // 7. Retorno inmediato al frontend (status 200) incluyendo la bandera prizeTriggered
    return NextResponse.json(
      {
        success: true,
        prizeTriggered,
        cycleCompleted: prizeTriggered,
        newTotal: persistedStamps,
        targetStamps: maxStamps,
        message: prizeTriggered
          ? "¡Tarjeta completada! El cliente ganó un premio y ya está listo para canjear."
          : "Sello sumado correctamente.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[stamps/add] Error crítico o timeout en el endpoint:", error);
    if (currentBusinessId) {
      try {
        const client = supabaseRef || createAdminClient();
        logMerchantNotification(client, {
          businessId: currentBusinessId,
          type: "error",
          message: `Fallo al procesar: ${error?.message || String(error)}`,
        });
      } catch {
        // Ignorar errores secundarios en el bloque catch
      }
    }
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
