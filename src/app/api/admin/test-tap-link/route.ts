import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTapTestToken } from "@/lib/mimo-customer-session";
import { canAccessBusiness } from "@/lib/authz";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "comercio";
}

export async function POST(request: Request) {
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });

  try {
    const { customerId, nfcId } = await request.json();
    if (!customerId) return NextResponse.json({ error: "Falta el cliente." }, { status: 400 });

    const supabase: any = createAdminClient();
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, business_id, businesses(slug, name)")
      .eq("id", customerId)
      .maybeSingle();
    if (customerError || !customer) return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    if (!await canAccessBusiness(customer.business_id)) {
      return NextResponse.json({ error: "No tenés permisos para generar links de este comercio." }, { status: 403 });
    }

    const tagQuery = supabase
      .from("nfc_tags")
      .select("nfc_id, active")
      .eq("business_id", customer.business_id)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(1);
    if (nfcId) tagQuery.eq("nfc_id", String(nfcId).trim().toUpperCase());
    const { data: existingTag, error: tagError } = await tagQuery.maybeSingle();
    if (tagError) return NextResponse.json({ error: "No se pudo consultar el NFC del negocio." }, { status: 500 });

    let tag = existingTag;
    if (!tag && !nfcId) {
      const business = Array.isArray(customer.businesses) ? customer.businesses[0] : customer.businesses;
      const baseNfcId = slugify(business?.slug || business?.name || "comercio");
      const { data: conflictingTag } = await supabase.from("nfc_tags").select("nfc_id").eq("nfc_id", baseNfcId).maybeSingle();
      const generatedNfcId = conflictingTag ? `${baseNfcId}-${crypto.randomUUID().replaceAll("-", "").slice(0, 4)}` : baseNfcId;
      const { data: createdTag, error: createTagError } = await supabase
        .from("nfc_tags")
        .insert({
          nfc_id: generatedNfcId,
          business_id: customer.business_id,
          label: "Tag de prueba · generado desde Clientes",
          active: true,
        })
        .select("nfc_id, active")
        .single();
      if (createTagError || !createdTag) return NextResponse.json({ error: "No se pudo crear el NFC de prueba." }, { status: 500 });
      tag = createdTag;
    }

    if (!tag) return NextResponse.json({ error: "Este negocio todavía no tiene un NFC activo." }, { status: 404 });

    const token = createTapTestToken(customer.id, tag.nfc_id);
    const origin = process.env.NEXT_PUBLIC_MIMO_SITE_URL || new URL(request.url).origin;
    return NextResponse.json({ url: `${origin}/api/tap?tag=${encodeURIComponent(tag.nfc_id)}&test=${encodeURIComponent(token)}` });
  } catch (error: any) {
    console.error("Test tap link error:", error);
    return NextResponse.json({ error: error?.message || "No se pudo crear el link de prueba." }, { status: 500 });
  }
}
