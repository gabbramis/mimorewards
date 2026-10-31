import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLoginDestination } from "@/lib/login-access";

export async function GET(request: NextRequest) {
  let destination = "/login";
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) {
      destination = await getLoginDestination(createAdminClient(), user, request.nextUrl.searchParams.get("next"))
        || "/login?error=inactive";
    }
  } catch (error) {
    console.error("No se pudo resolver el acceso al panel:", error);
    destination = "/login?error=access_error";
  }
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
