import { canAccessBusiness } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { counterPosterFilename, counterRegistrationUrl, createCounterPoster } from "@/lib/counter-poster";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const format = new URL(request.url).searchParams.get("format") || "a4";
  if (format !== "a4" && format !== "a6") {
    return Response.json({ error: "Elegí un formato válido: A4 o A6." }, { status: 400 });
  }
  const { businessId } = await params;
  if (!await canAccessBusiness(businessId)) {
    return Response.json({ error: "Necesitás iniciar sesión y tener acceso a este local." }, { status: 403 });
  }
  try {
    const supabase = createAdminClient();
    const { data: business, error } = await supabase.from("businesses")
      .select("id, name, slug, logo_url").eq("id", businessId)
      .maybeSingle<{ id: string; name: string; slug: string | null; logo_url: string | null }>();
    if (error) throw error;
    if (!business) return Response.json({ error: "No encontramos el local." }, { status: 404 });

    let logo: Buffer | null = null;
    if (business.logo_url) {
      // Only read from the configured logo bucket; never fetch arbitrary URLs.
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
      const prefix = `${base}/storage/v1/object/public/logos/`;
      if (!base || !business.logo_url.startsWith(prefix)) {
        return Response.json({ error: "Volvé a subir el logo del local para incluirlo en el PDF." }, { status: 422 });
      }
      const path = decodeURIComponent(business.logo_url.slice(prefix.length));
      if (!path || path.split("/").some(part => !part || part === "." || part === "..")) {
        return Response.json({ error: "El logo del local no es válido." }, { status: 422 });
      }
      const { data, error: logoError } = await supabase.storage.from("logos").download(path);
      if (logoError || !data || data.size > 2 * 1024 * 1024) {
        return Response.json({ error: "No pudimos cargar el logo. Revisalo en el diseño del local e intentá de nuevo." }, { status: 422 });
      }
      logo = Buffer.from(await data.arrayBuffer());
    }
    // Generate in memory and send directly to the browser; no file or database write.
    const bytes = await createCounterPoster({ businessName: business.name,
      registrationUrl: counterRegistrationUrl(business), logo, format });
    return new Response(new Uint8Array(bytes), { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${counterPosterFilename(business.name, format)}"`,
      "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    console.error("Error generando cartel de mostrador:", error);
    return Response.json({ error: "No pudimos generar el PDF. Intentá de nuevo." }, { status: 500 });
  }
}
