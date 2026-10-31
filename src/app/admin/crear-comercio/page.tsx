import { redirect } from "next/navigation";
import { isSuperadmin } from "@/lib/authz";
import CrearComercioForm from "./crear-comercio-form";

export default async function CrearComercioPage() {
  if (!(await isSuperadmin())) {
    redirect("/");
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Nuevo comercio</h1>
        <p className="mt-1.5 text-sm font-medium text-gray-500">
          Creá la cuenta del dueño, configurá su programa de sellos y registrá el comercio en un solo paso.
        </p>
      </div>
      <CrearComercioForm />
    </div>
  );
}
