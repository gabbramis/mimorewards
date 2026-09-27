import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperadmin } from "@/lib/authz";

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "comercio";
}

function withLinks(request: Request, business: any, tag: any) {
  const origin = process.env.NEXT_PUBLIC_MIMO_SITE_URL || new URL(request.url).origin;
  return {
    ...business,
    nfcId: tag?.nfc_id || null,
    nfcActive: tag?.active !== false,
    nfcUrl: tag?.nfc_id ? `${origin}/api/tap?tag=${encodeURIComponent(tag.nfc_id)}` : null,
  };
}

async function requireUser() {
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  return user;
}

async function requireSuperadmin() {
  return isSuperadmin();
}

async function uniqueSlug(supabase: any, name: string, currentId?: string) {
  const base = slugify(name);
  const { data: existing } = await supabase.from("businesses").select("id").eq("slug", base).maybeSingle();
  if (!existing || existing.id === currentId) return base;
  return `${base}-${crypto.randomUUID().replaceAll("-", "").slice(0, 4)}`;
}

async function ensureBusinessTag(supabase: any, business: any) {
  const { data: existingTag, error: tagError } = await supabase
    .from("nfc_tags")
    .select("nfc_id, active")
    .eq("business_id", business.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (tagError) throw tagError;
  if (existingTag) return existingTag;

  const desiredNfcId = slugify(business.slug || business.name);
  const { data: conflictingTag } = await supabase.from("nfc_tags").select("nfc_id").eq("nfc_id", desiredNfcId).maybeSingle();
  const nfcId = conflictingTag ? `${desiredNfcId}-${crypto.randomUUID().replaceAll("-", "").slice(0, 4)}` : desiredNfcId;
  const { data: createdTag, error: createError } = await supabase
    .from("nfc_tags")
    .insert({
      nfc_id: nfcId,
      business_id: business.id,
      label: `Soporte principal · ${business.name}`,
      active: true,
    })
    .select("nfc_id, active")
    .single();
  if (createError || !createdTag) throw createError || new Error("No se pudo crear el NFC del negocio.");
  return createdTag;
}

export async function GET(request: Request) {
  if (!await requireUser()) return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  if (!await requireSuperadmin()) return NextResponse.json({ error: "No tenés permisos para administrar negocios." }, { status: 403 });

  try {
    const supabase: any = createAdminClient();
    const { data, error } = await supabase
      .from("businesses")
      .select("id, slug, name, logo_url, reward_target, reward_description, active, nfc_tags(nfc_id, active)")
      .order("name");
    if (error) throw error;

    const businesses = await Promise.all((data || []).map(async (business: any) => {
      let current = business;
      if (!current.slug) {
        const slug = await uniqueSlug(supabase, current.name, current.id);
        const { data: updated } = await supabase.from("businesses").update({ slug }).eq("id", current.id).select("id, slug, name, logo_url, reward_target, reward_description, active").single();
        if (updated) current = updated;
      }
      const tag = current.nfc_tags?.[0] || await ensureBusinessTag(supabase, current);
      return withLinks(request, current, tag);
    }));
    return NextResponse.json({ businesses });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "No se pudieron cargar los negocios." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!await requireUser()) return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  if (!await requireSuperadmin()) return NextResponse.json({ error: "No tenés permisos para administrar negocios." }, { status: 403 });

  const supabase: any = createAdminClient();
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });

    const slug = await uniqueSlug(supabase, name);
    const { data: business, error } = await supabase
      .from("businesses")
      .insert({ name, slug, logo_url: body.logo_url || null, reward_target: Number(body.reward_target) || 10, reward_description: String(body.reward_description || "Un beneficio gratis"), active: true })
      .select("id, slug, name, logo_url, reward_target, reward_description, active")
      .single();
    if (error || !business) throw error || new Error("No se pudo crear el negocio.");

    const tag = await ensureBusinessTag(supabase, business);
    return NextResponse.json({ business: withLinks(request, business, tag) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Error al crear el negocio." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!await requireUser()) return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  if (!await requireSuperadmin()) return NextResponse.json({ error: "No tenés permisos para administrar negocios." }, { status: 403 });

  const supabase: any = createAdminClient();
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!body.id || !name) return NextResponse.json({ error: "ID y nombre son obligatorios." }, { status: 400 });

    const { data: existing } = await supabase.from("businesses").select("slug").eq("id", body.id).maybeSingle();
    const slug = existing?.slug || await uniqueSlug(supabase, name, body.id);
    const { data: business, error } = await supabase
      .from("businesses")
      .update({ name, slug, logo_url: body.logo_url || null, reward_target: Number(body.reward_target) || 10, reward_description: String(body.reward_description || "Un beneficio gratis"), active: body.active !== false })
      .eq("id", body.id)
      .select("id, slug, name, logo_url, reward_target, reward_description, active")
      .single();
    if (error || !business) throw error || new Error("No se pudo actualizar el negocio.");

    const tag = await ensureBusinessTag(supabase, business);
    return NextResponse.json({ business: withLinks(request, business, tag) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Error al actualizar el negocio." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!await requireUser()) return NextResponse.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  if (!await requireSuperadmin()) return NextResponse.json({ error: "No tenés permisos para administrar negocios." }, { status: 403 });

  const supabase: any = createAdminClient();
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "ID es obligatorio." }, { status: 400 });
    const { error } = await supabase.from("businesses").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Error al eliminar el negocio." }, { status: 500 });
  }
}
