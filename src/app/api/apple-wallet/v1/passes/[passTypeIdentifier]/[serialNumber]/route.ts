import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readWalletLocations } from '@/lib/wallet/location-store';
import { resolveAppleWebServiceURL } from '@/lib/wallet/apple-web-service';
import {
  appleWalletConfigured,
  createAppleWalletPass,
  storedImage,
  verifyPassAuthToken,
  PASS_TYPE_ID,
} from "@/lib/wallet/appleWallet";

export const runtime = "nodejs";

/**
 * GET /api/apple-wallet/v1/passes/[passTypeIdentifier]/[serialNumber]
 * Endpoint oficial de Apple Wallet para descargar la última versión firmada del pase (.pkpass).
 * Cuando el iPhone recibe el APNs push y obtiene el serial, llama a este endpoint para actualizar la tarjeta.
 */
export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      passTypeIdentifier: string;
      serialNumber: string;
    }>;
  },
) {
  try {
    const { passTypeIdentifier, serialNumber } = await params;
    console.log(`[Apple Wallet Pull - Pass] Solicitud recibida para descargar pase. Serial: ${serialNumber}, topic: ${passTypeIdentifier}`);

    if (passTypeIdentifier !== PASS_TYPE_ID) {
      console.warn(`[Apple Wallet Pull - Pass] Topic inválido: ${passTypeIdentifier} (esperado: ${PASS_TYPE_ID})`);
      return new Response(null, { status: 404 });
    }

    // 1. Validar cabecera Authorization: ApplePass <token>
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("ApplePass ")) {
      console.warn('[Apple Wallet Pull - Pass]', { status: 401, reason: 'missing_authorization', host: new URL(request.url).host });
      return new Response(null, { status: 401 });
    }

    const token = authHeader.replace(/^ApplePass\s+/, "").trim();
    if (!verifyPassAuthToken(serialNumber, token)) {
      console.warn('[Apple Wallet Pull - Pass]', { status: 401, reason: 'invalid_authentication', host: new URL(request.url).host });
      return new Response(null, { status: 401 });
    }

    if (!appleWalletConfigured()) {
      console.error("[Apple Wallet Pull - Pass] Certificados no configurados en el servidor.");
      return new Response(null, { status: 503 });
    }

    const supabase: any = createAdminClient();

    // 2. Obtener la tarjeta de fidelización (serialNumber = loyalty_cards.id)
    const { data: card, error: cardError } = await supabase
      .from("loyalty_cards")
      .select("id, customer_id, business_id, current_stamps, updated_at, created_at")
      .eq("id", serialNumber)
      .maybeSingle();

    if (cardError) {
      console.error("[Apple Wallet Pull - Pass] Error buscando loyalty card:", cardError);
      return new Response(null, { status: 500 });
    }

    if (!card) {
      console.warn(`[Apple Wallet Pull - Pass] Tarjeta no encontrada para serial: ${serialNumber}`);
      return new Response(null, { status: 404 });
    }

    // 3. Obtener datos de cliente y negocio
    const [{ data: customer, error: customerError }, { data: business, error: businessError }] = await Promise.all([
      supabase
        .from("customers")
        .select("id, first_name, last_name, unique_code, current_stamps")
        .eq("id", card.customer_id)
        .eq("business_id", card.business_id)
        .maybeSingle(),
      supabase
        .from("businesses")
        .select("*")
        .eq("id", card.business_id)
        .maybeSingle(),
    ]);

    if (customerError || businessError) {
      console.error("[Apple Wallet Pull - Pass] Error consultando cliente o negocio:", { customerError, businessError });
      return new Response(null, { status: 500 });
    }

    if (!customer || !business || business.active === false) {
      console.warn(`[Apple Wallet Pull - Pass] Cliente o negocio inactivo para serial: ${serialNumber}`);
      return new Response(null, { status: 404 });
    }

    // 4. Descargar imágenes de marca si están configuradas
    const [logoImage, completedStampImage, pendingStampImage] = await Promise.all([
      storedImage(supabase, business.logo_url),
      storedImage(supabase, business.stamp_completed_url),
      storedImage(supabase, business.stamp_pending_url),
    ]);

    const currentStamps = customer.current_stamps ?? card.current_stamps ?? 0;
    const targetStamps = business.reward_target || 10;

    // 5. Generar el pase .pkpass actualizado con changeMessage
    const passBuffer = await createAppleWalletPass({
      webServiceURL: resolveAppleWebServiceURL(request.url, process.env.APPLE_WALLET_WEB_SERVICE_URL),
      locations: await readWalletLocations(card.business_id),
      id: card.id,
      customerName: `${customer.first_name} ${customer.last_name || ""}`.trim(),
      customerCode: customer.unique_code,
      businessName: business.name,
      currentStamps,
      targetStamps,
      rewardDescription: business.reward_description || "Tu próxima recompensa",
      primaryColor: business.primary_color,
      textColor: business.card_text_color,
      accentColor: business.card_accent_color,
      stampBackgroundColor: business.stamp_background_color,
      logoImage,
      completedStampImage,
      pendingStampImage,
      activeCampaignMessage: business.active_campaign_message,
      wallet: business.wallet_config,
    });

    console.log(
      `[Apple Wallet Pull - Pass] 200 OK: Entregando pase actualizado para ${customer.first_name} (${customer.unique_code}). Sellos: ${currentStamps}/${targetStamps}. HeaderField value: "${currentStamps} / ${targetStamps}"`
    );

    return new Response(new Uint8Array(passBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Last-Modified": new Date().toUTCString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[Apple Wallet Pull - Pass] Error generando pase actualizado:", error);
    return new Response(null, { status: 500 });
  }
}
