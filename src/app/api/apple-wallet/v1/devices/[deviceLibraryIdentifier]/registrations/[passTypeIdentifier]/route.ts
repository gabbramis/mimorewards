import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

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

    const supabase: any = createAdminClient();

    // 1. Obtener los pases registrados para este dispositivo desde wallet_registrations (o fallback wallet_devices)
    const [{ data: regs }, { data: legacyDevices }] = await Promise.all([
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

    const serialSet = new Set<string>();
    (regs || []).forEach((r: any) => serialSet.add(r.serial_number));
    (legacyDevices || []).forEach((d: any) => serialSet.add(d.serial_number));

    if (serialSet.size === 0) {
      return new Response(null, { status: 204 });
    }

    const serialNumbers = Array.from(serialSet);

    // 2. Consultar las tarjetas correspondientes para conocer su fecha de modificación
    const { data: cards, error: cardsError } = await supabase
      .from("loyalty_cards")
      .select("id, updated_at, created_at")
      .in("id", serialNumbers);

    if (cardsError) {
      console.error("[Apple Wallet] Error querying loyalty cards:", cardsError);
      return new Response(null, { status: 500 });
    }

    if (!cards || cards.length === 0) {
      return new Response(null, { status: 204 });
    }

    let changedCards = cards;

    if (passesUpdatedSince) {
      const sinceDate = !isNaN(Number(passesUpdatedSince))
        ? new Date(Number(passesUpdatedSince))
        : new Date(passesUpdatedSince);

      const sinceTimestamp = sinceDate.getTime();

      if (!isNaN(sinceTimestamp)) {
        changedCards = cards.filter((c: any) => {
          const cardDate = new Date(c.updated_at || c.created_at || 0).getTime();
          return cardDate > sinceTimestamp;
        });
      }
    }

    if (changedCards.length === 0) {
      return new Response(null, { status: 204 });
    }

    // Calcular el tag de actualización más reciente
    let maxTimestamp = 0;
    for (const c of cards) {
      const cardDate = new Date((c as any).updated_at || (c as any).created_at || 0).getTime();
      if (cardDate > maxTimestamp) {
        maxTimestamp = cardDate;
      }
    }

    const lastUpdated = maxTimestamp > 0
      ? new Date(maxTimestamp).toISOString()
      : new Date().toISOString();

    return NextResponse.json({
      lastUpdated,
      serialNumbers: changedCards.map((c: any) => String(c.id)),
    });
  } catch (error) {
    console.error("[Apple Wallet] Unexpected error in registrations GET:", error);
    return new Response(null, { status: 500 });
  }
}
