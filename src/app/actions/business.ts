"use server";

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export type RegisterBusinessResult = { success: boolean; error?: string };

const SUPER_ADMIN_EMAIL = "creator@mimorewards.com";

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // elimina tildes
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // elimina caracteres especiales
    .replace(/[\s-]+/g, "-") // espacios a guiones
    .replace(/^-+|-+$/g, "");
}

export async function registerNewBusiness(formData: FormData): Promise<RegisterBusinessResult> {
  // Verificación de sesión (cliente normal con cookies)
  const sessionClient = await createSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user || user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL) {
    return { success: false, error: "Acceso denegado: Privilegios insuficientes" };
  }

  const businessName = String(formData.get("businessName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const rewardTarget = Math.floor(Number(formData.get("rewardTarget") ?? 10));
  const rewardDescription = String(formData.get("rewardDescription") ?? "").trim() || "Un beneficio gratis";
  const isActive = String(formData.get("active") ?? "true") !== "false";
  const logo = formData.get("logo");
  const logoFile = logo instanceof File && logo.size > 0 ? logo : null;

  if (!businessName || !email || !password) {
    return { success: false, error: "Todos los campos son obligatorios." };
  }
  if (!Number.isFinite(rewardTarget) || rewardTarget < 1 || rewardTarget > 100) {
    return { success: false, error: "La meta de sellos debe ser un número entre 1 y 100." };
  }
  if (logoFile) {
    if (!logoFile.type.startsWith("image/")) {
      return { success: false, error: "El logo debe ser una imagen." };
    }
    if (logoFile.size > 900 * 1024) {
      return { success: false, error: "El logo no puede pesar más de 900 KB." };
    }
  }

  const baseSlug = slugify(businessName);
  if (!baseSlug) {
    return { success: false, error: "El nombre del comercio no genera un slug válido." };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return { success: false, error: "Faltan variables de entorno de Supabase." };
  }

  const supabaseAdmin = createSupabaseAdmin(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Slug único: si ya existe, se agrega un sufijo numérico (cafe-central-1, -2, ...)
  const { data: existingSlugs, error: slugError } = await supabaseAdmin
    .from("businesses")
    .select("slug")
    .or(`slug.eq.${baseSlug},slug.like.${baseSlug}-%`);
  if (slugError) {
    return { success: false, error: slugError.message };
  }
  const taken = new Set((existingSlugs ?? []).map((row: { slug: string }) => row.slug));
  let slug = baseSlug;
  for (let n = 1; taken.has(slug); n++) {
    slug = `${baseSlug}-${n}`;
  }

  // Paso 1: crear el usuario dueño
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userError || !userData?.user) {
    return { success: false, error: userError?.message ?? "No se pudo crear el usuario." };
  }
  const userId = userData.user.id;

  // Paso 2: crear el comercio
  const { data: business, error: businessError } = await supabaseAdmin
    .from("businesses")
    .insert({ name: businessName, slug, reward_target: rewardTarget, reward_description: rewardDescription, active: isActive })
    .select("id")
    .single();
  if (businessError || !business) {
    await supabaseAdmin.auth.admin.deleteUser(userId); // rollback: sin usuario huérfano
    return { success: false, error: businessError?.message ?? "No se pudo crear el comercio." };
  }
  const businessId = business.id as string;

  // Paso 3: vincular usuario y comercio
  const { error: memberError } = await supabaseAdmin
    .from("business_members")
    .insert({ user_id: userId, business_id: businessId, role: "merchant" });
  if (memberError) {
    // rollback: sin datos huérfanos
    await supabaseAdmin.from("businesses").delete().eq("id", businessId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return { success: false, error: memberError.message };
  }

  // Paso 4 (opcional): subir el logo y guardarlo en el comercio
  if (logoFile) {
    const ext = (logoFile.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const filePath = `${businessId}-${Date.now()}.${ext || "png"}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("logos")
      .upload(filePath, logoFile, { upsert: true, contentType: logoFile.type });
    if (uploadError) {
      await supabaseAdmin.from("businesses").delete().eq("id", businessId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return { success: false, error: `No se pudo subir el logo: ${uploadError.message}` };
    }

    const { data: publicUrl } = supabaseAdmin.storage.from("logos").getPublicUrl(filePath);
    const { error: logoError } = await supabaseAdmin
      .from("businesses")
      .update({ logo_url: publicUrl.publicUrl })
      .eq("id", businessId);
    if (logoError) {
      await supabaseAdmin.storage.from("logos").remove([filePath]);
      await supabaseAdmin.from("businesses").delete().eq("id", businessId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return { success: false, error: logoError.message };
    }
  }

  return { success: true };
}
