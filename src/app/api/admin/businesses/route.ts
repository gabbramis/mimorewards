import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "comercio"; }
function nfcToken() { return `MIMO-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`; }
function withLinks(request: Request, business: any, tag: any) { const origin = process.env.NEXT_PUBLIC_MIMO_SITE_URL || new URL(request.url).origin; return { ...business, nfcId: tag?.nfc_id || null, nfcActive: tag?.active !== false, nfcUrl: tag?.nfc_id ? `${origin}/t/${encodeURIComponent(tag.nfc_id)}` : null }; }

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("businesses").select("id, slug, name, logo_url, reward_target, reward_description, active, nfc_tags(nfc_id, active)").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ businesses: (data || []).map((business: any) => withLinks(request, business, business.nfc_tags?.[0])) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  try {
    const body = await request.json(); const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
    const slug = `${slugify(name)}-${crypto.randomUUID().slice(0, 4)}`;
    const { data: business, error } = await supabase.from("businesses").insert({ name, slug, logo_url: body.logo_url || null, reward_target: Number(body.reward_target) || 10, reward_description: String(body.reward_description || "Un beneficio gratis"), active: true }).select("id, slug, name, logo_url, reward_target, reward_description, active").single();
    if (error || !business) throw error || new Error("No se pudo crear el negocio.");
    const nfc_id = nfcToken();
    const { data: tag, error: tagError } = await supabase.from("nfc_tags").insert({ nfc_id, business_id: business.id, label: `Soporte principal · ${name}`, active: true }).select("nfc_id, active").single();
    if (tagError) throw tagError;
    return NextResponse.json({ business: withLinks(request, business, tag) }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error?.message || "Error al crear el negocio." }, { status: 500 }); }
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  try {
    const body = await request.json();
    if (!body.id || !String(body.name || "").trim()) return NextResponse.json({ error: "ID y nombre son obligatorios." }, { status: 400 });
    const { data: business, error } = await supabase.from("businesses").update({ name: String(body.name).trim(), logo_url: body.logo_url || null, reward_target: Number(body.reward_target) || 10, reward_description: String(body.reward_description || "Un beneficio gratis"), active: body.active !== false }).eq("id", body.id).select("id, slug, name, logo_url, reward_target, reward_description, active").single();
    if (error || !business) throw error || new Error("No se pudo actualizar el negocio.");
    const { data: tag } = await supabase.from("nfc_tags").select("nfc_id, active").eq("business_id", business.id).order("created_at").limit(1).maybeSingle();
    return NextResponse.json({ business: withLinks(request, business, tag) });
  } catch (error: any) { return NextResponse.json({ error: error?.message || "Error al actualizar el negocio." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  try { const { id } = await request.json(); if (!id) return NextResponse.json({ error: "ID es obligatorio." }, { status: 400 }); const { error } = await supabase.from("businesses").delete().eq("id", id); if (error) throw error; return NextResponse.json({ success: true }); }
  catch (error: any) { return NextResponse.json({ error: error?.message || "Error al eliminar el negocio." }, { status: 500 }); }
}
