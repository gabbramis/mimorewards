import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/apple-wallet/v1/devices/[deviceLibraryIdentifier]/registrations/[passTypeIdentifier]
 * Endpoint oficial de Apple Wallet para consultar pases modificados asociados a un dispositivo.
 * Cuando el iPhone recibe el push silencioso APNs, llama inmediatamente a este endpoint.
 */
export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      deviceLibraryIdentifier: string;
      passTypeIdentifier: string;
    }>;
  },
) {
  try {
    const { deviceLibraryIdentifier, passTypeIdentifier } = await params;
    const url = new URL(request.url);
    const passesUpdatedSince = url.searchParams.get("passesUpdatedSince");

    console.log(
      `[Apple Wallet Pull - Registrations] Solicitud recibida. Dispositivo: ${deviceLibraryIdentifier}, topic: ${passTypeIdentifier}, tag previo: ${passesUpdatedSince || "ninguno"}`
    );

    const supabase: any = createAdminClient();

    // 1. Obtener los pases registrados para este dispositivo desde wallet_registrations (o fallback wallet_devices)
    const [{ data: regs, error: regsErr }, { data: legacyDevices, error: legacyErr }] = await Promise.all([
      supabase
        .from("wallet_registrations")
        .select("serial_number")
        .eq("device_library_identifier", deviceLibraryIdentifier)
        .eq("pass_type_identifier", passTypeIdentifier),
      supabase
        .from("wallet_devices")
        .select("serial_number")
        .eq("device_library_identifier", deviceLibraryIdentifier)
        .eq("pass_type_identifier", passTypeIdentifier),
    ]);

    if (regsErr && legacyErr) {
      console.error("[Apple Wallet Pull - Registrations] Error consultando registros en base de datos:", { regsErr, legacyErr });
      return new Response(null, { status: 500 });
    }

    const serialSet = new Set<string>();
    (regs || []).forEach((r: any) => { if (r.serial_number) serialSet.add(r.serial_number); });
    (legacyDevices || []).forEach((d: any) => { if (d.serial_number) serialSet.add(d.serial_number); });

    if (serialSet.size === 0) {
      console.log(`[Apple Wallet Pull - Registrations] 204 No Content: No hay tarjetas registradas para el dispositivo ${deviceLibraryIdentifier}.`);
      return new Response(null, { status: 204 });
    }

    const serialNumbers = Array.from(serialSet);

    // 2. Generar un updateTag (timestamp) siempre nuevo para forzar al dispositivo a descargar la tarjeta actualizada
    const updateTag = String(Date.now());

    console.log(
      `[Apple Wallet Pull - Registrations] 200 OK: Entregando ${serialNumbers.length} pase(s) seriales [${serialNumbers.join(", ")}] con updateTag=${updateTag}`
    );

    return NextResponse.json({
      lastUpdated: updateTag,
      serialNumbers: serialNumbers.map(String),
    });
  } catch (error) {
    console.error("[Apple Wallet Pull - Registrations] Error inesperado:", error);
    return new Response(null, { status: 500 });
  }
}
