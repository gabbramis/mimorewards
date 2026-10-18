import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassAuthToken } from "@/lib/wallet/appleWallet";

export const runtime = "nodejs";

function getAuthToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader) return null;
  const match = authHeader.match(/^ApplePass\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * POST /api/wallet/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/[serialNumber]
 * Registra un dispositivo iOS para recibir notificaciones push cuando cambia el pase.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string; serialNumber: string }> }
) {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = await params;
    const authToken = getAuthToken(request);

    if (!authToken || !verifyPassAuthToken(serialNumber, authToken)) {
      return new Response(null, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const pushToken = typeof body?.pushToken === "string" ? body.pushToken.trim() : "";

    if (!pushToken) {
      return NextResponse.json({ error: "Falta pushToken" }, { status: 400 });
    }

    const supabase: any = createAdminClient();

    // 1. Obtener customer_id y business_id de loyalty_cards
    const { data: card } = await supabase
      .from("loyalty_cards")
      .select("id, customer_id, business_id, wallet_platform")
      .eq("id", serialNumber)
      .maybeSingle();

    const customerId = card?.customer_id || null;
    const businessId = card?.business_id || null;

    // 2. Comprobar si ya existe el registro en wallet_registrations
    const { data: existing } = await supabase
      .from("wallet_registrations")
      .select("id")
      .eq("device_library_identifier", deviceLibraryIdentifier)
      .eq("pass_type_identifier", passTypeIdentifier)
      .eq("serial_number", serialNumber)
      .maybeSingle();

    // 3. Upsert en wallet_registrations
    await supabase.from("wallet_registrations").upsert(
      {
        customer_id: customerId,
        business_id: businessId,
        device_library_identifier: deviceLibraryIdentifier,
        pass_type_identifier: passTypeIdentifier,
        serial_number: serialNumber,
        push_token: pushToken,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "device_library_identifier,pass_type_identifier,serial_number",
      }
    );

    // 4. Upsert en wallet_devices
    await supabase.from("wallet_devices").upsert(
      {
        device_library_identifier: deviceLibraryIdentifier,
        pass_type_identifier: passTypeIdentifier,
        serial_number: serialNumber,
        push_token: pushToken,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "device_library_identifier,pass_type_identifier,serial_number",
      }
    );

    // 5. Marcar wallet_platform en customers
    if (customerId) {
      const { data: customer } = await supabase
        .from("customers")
        .select("wallet_platform")
        .eq("id", customerId)
        .maybeSingle();

      const newPlatform = customer?.wallet_platform === "GOOGLE" ? "BOTH" : "APPLE";
      await supabase
        .from("customers")
        .update({
          wallet_platform: newPlatform,
          apple_push_token: pushToken,
        })
        .eq("id", customerId);
    }

    // 200 si ya estaba registrado, 201 si es un nuevo registro
    return new Response(null, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("[Apple Wallet] Error en registro de dispositivo:", error);
    return new Response(null, { status: 500 });
  }
}

/**
 * DELETE /api/wallet/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]/[serialNumber]
 * Da de baja un dispositivo iOS cuando el usuario elimina la tarjeta de Apple Wallet.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string; serialNumber: string }> }
) {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = await params;
    const authToken = getAuthToken(request);

    if (!authToken || !verifyPassAuthToken(serialNumber, authToken)) {
      return new Response(null, { status: 401 });
    }

    const supabase: any = createAdminClient();
    await Promise.all([
      supabase
        .from("wallet_registrations")
        .delete()
        .eq("device_library_identifier", deviceLibraryIdentifier)
        .eq("pass_type_identifier", passTypeIdentifier)
        .eq("serial_number", serialNumber),
      supabase
        .from("wallet_devices")
        .delete()
        .eq("device_library_identifier", deviceLibraryIdentifier)
        .eq("pass_type_identifier", passTypeIdentifier)
        .eq("serial_number", serialNumber),
    ]);

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("[Apple Wallet] Error en baja de dispositivo:", error);
    return new Response(null, { status: 500 });
  }
}
