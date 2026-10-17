import { NextResponse } from "next/server";
import { getCurrentAccess, canAccessBusiness } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { user } = await getCurrentAccess();
    if (!user) {
      return NextResponse.json(
        { error: "Necesitás iniciar sesión." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const businessId = String(formData.get("businessId") || "").trim();

    if (!businessId) {
      return NextResponse.json(
        { error: "Identificador de comercio faltante." },
        { status: 400 }
      );
    }

    if (!(await canAccessBusiness(businessId))) {
      return NextResponse.json(
        { error: "No tenés permisos para administrar este comercio." },
        { status: 403 }
      );
    }

    const supabase: any = createAdminClient();

    const name = String(formData.get("name") || "").trim();
    const rawTarget = Number(formData.get("rewardTarget"));
    const rewardTarget = Number.isInteger(rawTarget) ? rawTarget : 10;
    const rewardDescription = String(
      formData.get("rewardDescription") || ""
    ).trim();
    const rawColor = String(formData.get("primaryColor") || "").trim();
    const primaryColor = /^#[0-9a-fA-F]{6}$/i.test(rawColor)
      ? rawColor.toUpperCase()
      : "#FF1F2D";

    if (!name) {
      return NextResponse.json(
        { error: "El nombre del comercio no puede estar vacío." },
        { status: 400 }
      );
    }

    if (rewardTarget < 4 || rewardTarget > 15) {
      return NextResponse.json(
        { error: "La meta de sellos debe ser entre 4 y 15." },
        { status: 400 }
      );
    }

    // Manejo de logo si se adjuntó archivo
    let logoUrl: string | undefined = undefined;
    const logoFile = formData.get("logo");
    if (logoFile instanceof File && logoFile.size > 0) {
      if (!logoFile.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "El archivo de logo debe ser una imagen válida." },
          { status: 400 }
        );
      }
      if (logoFile.size > 800 * 1024) {
        return NextResponse.json(
          { error: "El logo no debe superar los 800 KB." },
          { status: 400 }
        );
      }

      const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
      const fileName = `${businessId}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(fileName, logoFile, { upsert: true, contentType: logoFile.type });

      if (uploadError) {
        return NextResponse.json(
          { error: `Error subiendo logo: ${uploadError.message}` },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from("logos")
        .getPublicUrl(fileName);
      logoUrl = publicUrlData?.publicUrl;
    }

    const updatePayload: Record<string, any> = {
      name,
      reward_target: rewardTarget,
      reward_description: rewardDescription || "Beneficio gratis",
    };

    if (rawColor && /^#[0-9a-fA-F]{6}$/i.test(rawColor)) {
      updatePayload.primary_color = rawColor.toUpperCase();
    }

    if (logoUrl) {
      updatePayload.logo_url = logoUrl;
    }

    const { data: updatedBusiness, error: updateError } = await supabase
      .from("businesses")
      .update(updatePayload)
      .eq("id", businessId)
      .select("id, name, logo_url, primary_color, reward_target, reward_description")
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      business: updatedBusiness,
      message: "Configuración guardada exitosamente.",
    });
  } catch (error: any) {
    console.error("Error updating merchant settings:", error);
    return NextResponse.json(
      { error: error.message || "Error al actualizar la configuración." },
      { status: 500 }
    );
  }
}
