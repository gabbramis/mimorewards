import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, logo_url, reward_target, reward_description")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ businesses: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  try {
    const body = await request.json();
    const { name, logo_url, reward_target, reward_description } = body;

    if (!name) {
      return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("businesses")
      .insert([{ name, logo_url, reward_target, reward_description }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ business: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al crear el negocio." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  try {
    const body = await request.json();
    const { id, name, logo_url, reward_target, reward_description } = body;

    if (!id || !name) {
      return NextResponse.json({ error: "ID y nombre son obligatorios." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("businesses")
      .update({ name, logo_url, reward_target, reward_description })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ business: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al actualizar el negocio." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID es obligatorio." }, { status: 400 });
    }

    const { error } = await supabase.from("businesses").delete().eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al eliminar el negocio." }, { status: 500 });
  }
}
