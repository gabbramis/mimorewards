import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CrearComercioForm from "./crear-comercio-form";

const SUPER_ADMIN_EMAIL = "creator@mimorewards.com";

export default async function CrearComercioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL) {
    redirect("/");
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Nuevo comercio</h1>
        <p className="mt-1.5 text-sm font-medium text-gray-500">
          Creá la cuenta del dueño, configurá su programa de sellos y registrá el comercio en un solo paso.
        </p>
      </div>
      <CrearComercioForm />
    </main>
  );
}
