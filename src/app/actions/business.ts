"use server";

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/lib/supabase/server";

export type RegisterBusinessResult = { success: boolean; error?: string };

const SUPER_ADMIN_EMAIL = "creator@mimorewards.com";
const MAX_LOGO_BYTES = 800 * 1024; // 800 KB

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
  // 1. Verificación de sesión de superadmin
  const sessionClient = await createSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user || user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL) {
    return { success: false, error: "Acceso denegado: Privilegios insuficientes" };
  }

  // 2. Extracción y validación de campos
  const businessName = String(formData.get("businessName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const rewardTarget = Math.floor(Number(formData.get("rewardTarget") ?? 10));
  const rewardDescription = String(formData.get("rewardDescription") ?? "").trim() || "Un beneficio gratis";
  const isActive = String(formData.get("active") ?? "true") !== "false";

  // Color primario de marca (hex válido, fallback a #FF1F2D)
  const rawColor = String(formData.get("primaryColor") ?? "").trim();
  const primaryColor = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor.toUpperCase() : "#FF1F2D";

  // Archivo real de logo
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
    if (logoFile.size > MAX_LOGO_BYTES) {
      return { success: false, error: "El logo no puede pesar más de 800 KB." };
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

  // 3. Generación de slug único para el negocio
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

  // 4. Crear usuario dueño en Supabase Auth
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userError || !userData?.user) {
    return { success: false, error: userError?.message ?? "No se pudo crear el usuario." };
  }
  const userId = userData.user.id;

  // 5. Guardado real del logo en Supabase Storage (sin URLs random)
  let logoPath: string | null = null;
  let logoUrl: string | null = null;
  if (logoFile) {
    const ext = (logoFile.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    logoPath = `${slug}-${Date.now()}.${ext || "png"}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("logos")
      .upload(logoPath, logoFile, { upsert: true, contentType: logoFile.type });

    if (uploadError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return { success: false, error: `No se pudo subir el logo: ${uploadError.message}` };
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from("logos").getPublicUrl(logoPath);
    logoUrl = publicUrlData?.publicUrl || null;
  }

  // Función de rollback para evitar datos o archivos huérfanos si algún paso falla
  const rollback = async (businessId?: string) => {
    if (businessId) {
      await supabaseAdmin.from("businesses").delete().eq("id", businessId);
    }
    if (logoPath) {
      await supabaseAdmin.storage.from("logos").remove([logoPath]);
    }
    await supabaseAdmin.auth.admin.deleteUser(userId);
  };

  // 6. INSERT inicial en la tabla businesses con logo real y color de marca
  const { data: business, error: businessError } = await supabaseAdmin
    .from("businesses")
    .insert({
      name: businessName,
      slug,
      reward_target: rewardTarget,
      reward_description: rewardDescription,
      active: isActive,
      logo_url: logoUrl,
      primary_color: primaryColor,
    })
    .select("id")
    .single();

  if (businessError || !business) {
    await rollback();
    return { success: false, error: businessError?.message ?? "No se pudo crear el comercio." };
  }
  const businessId = business.id as string;

  // 7. Vincular usuario con el comercio
  const { error: memberError } = await supabaseAdmin
    .from("business_members")
    .insert({ user_id: userId, business_id: businessId, role: "merchant" });

  if (memberError) {
    await rollback(businessId);
    return { success: false, error: memberError.message };
  }

  // 8. Generar el tag NFC automáticamente en el alta inicial (nfc_id = slug)
  let nfcCreated = false;
  let nfcError: string | undefined;

  for (let attempt = 0; attempt < 5 && !nfcCreated; attempt++) {
    const nfcId = attempt === 0 ? slug : `${slug}-${crypto.randomUUID().replaceAll("-", "").slice(0, 4)}`;
    const { error: tagInsertError } = await supabaseAdmin.from("nfc_tags").insert({
      nfc_id: nfcId,
      business_id: businessId,
      label: `Soporte principal · ${businessName}`,
      active: true,
    });

    if (!tagInsertError) {
      nfcCreated = true;
    } else {
      nfcError = tagInsertError.message;
      if (tagInsertError.code !== "23505") break; // Si no es conflicto de unicidad, aborta reintentos
    }
  }

  if (!nfcCreated) {
    await supabaseAdmin.from("business_members").delete().eq("business_id", businessId);
    await rollback(businessId);
    return { success: false, error: `No se pudo crear el tag NFC: ${nfcError ?? "error desconocido"}` };
  }

  return { success: true };
}
