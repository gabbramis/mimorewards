"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperadmin } from "@/lib/authz";

export type AdminWhitelistEntry = {
  id: string;
  email: string;
  created_at: string;
};

export async function getAdminWhitelist(): Promise<{
  entries: AdminWhitelistEntry[];
  error?: string;
}> {
  if (!(await isSuperadmin())) {
    return { entries: [], error: "No tenés permisos para ver esta sección." };
  }

  try {
    const supabase: any = createAdminClient();
    const { data, error } = await supabase
      .from("admin_whitelist")
      .select("id, email, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return { entries: [], error: error.message || "Error al consultar admin_whitelist." };
    }

    return { entries: (data || []) as AdminWhitelistEntry[] };
  } catch (err: any) {
    return { entries: [], error: err?.message || "No se pudo cargar la lista de accesos." };
  }
}

export async function grantAdminAccess(rawEmail: string): Promise<{
  ok: boolean;
  entry?: AdminWhitelistEntry;
  error?: string;
}> {
  if (!(await isSuperadmin())) {
    return { ok: false, error: "No tenés permisos para conceder accesos." };
  }

  const email = String(rawEmail || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Ingresá un correo electrónico válido." };
  }

  try {
    const supabase: any = createAdminClient();

    const { data: existing } = await supabase
      .from("admin_whitelist")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return { ok: false, error: "Este correo ya tiene acceso de Super Administrador." };
    }

    const { data: created, error } = await supabase
      .from("admin_whitelist")
      .insert({ email })
      .select("id, email, created_at")
      .single();

    if (error || !created) {
      return { ok: false, error: error?.message || "No se pudo agregar el correo a la whitelist." };
    }

    revalidatePath("/admin/accesos");
    return { ok: true, entry: created as AdminWhitelistEntry };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error inesperado al conceder acceso." };
  }
}

export async function revokeAdminAccess(id: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!(await isSuperadmin())) {
    return { ok: false, error: "No tenés permisos para revocar accesos." };
  }

  const cleanId = String(id || "").trim();
  if (!cleanId) {
    return { ok: false, error: "ID de registro inválido." };
  }

  try {
    const supabase: any = createAdminClient();
    const { error } = await supabase
      .from("admin_whitelist")
      .delete()
      .eq("id", cleanId);

    if (error) {
      return { ok: false, error: error.message || "No se pudo revocar el acceso." };
    }

    revalidatePath("/admin/accesos");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error inesperado al revocar acceso." };
  }
}

