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

    // Comprobar si ya existe el registro
    const { data: existing } = await supabase
      .from("wallet_devices")
      .select("id")
      .eq("device_library_identifier", deviceLibraryIdentifier)
      .eq("pass_type_identifier", passTypeIdentifier)
      .eq("serial_number", serialNumber)
      .maybeSingle();

    const { error: upsertErr } = await supabase
      .from("wallet_devices")
      .upsert(
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

    if (upsertErr) {
      console.error("[Apple Wallet] Error guardando registro en wallet_devices:", upsertErr);
      return new Response(null, { status: 500 });
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
    const { error } = await supabase
      .from("wallet_devices")
      .delete()
      .eq("device_library_identifier", deviceLibraryIdentifier)
      .eq("pass_type_identifier", passTypeIdentifier)
      .eq("serial_number", serialNumber);

    if (error) {
      console.error("[Apple Wallet] Error eliminando registro en wallet_devices:", error);
      return new Response(null, { status: 500 });
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("[Apple Wallet] Error en baja de dispositivo:", error);
    return new Response(null, { status: 500 });
  }
}
