import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import CashierScanner from "@/components/shared/CashierScanner";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ businessId: string }>;
}

export default async function MerchantScannerPage({ params }: PageProps) {
  const { businessId } = await params;
  const supabase: any = createAdminClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .maybeSingle();

  if (!business) {
    notFound();
  }

  return (
    <div className="space-y-6 pb-12 max-w-lg mx-auto">
      {/* Header */}
      <div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#737373]">
          Gestión Operativa
        </span>
        <h2 className="text-2xl font-bold tracking-tight text-[#1F1F1F]">
          Escáner de Caja
        </h2>
        <p className="text-xs text-[#737373] mt-0.5">
          Escaneá el código QR del cliente para acreditar visitas y sumar sellos al instante en {business.name}.
        </p>
      </div>

      {/* Componente Escáner de Caja */}
      <div className="flex justify-center">
        <CashierScanner businessId={businessId} />
      </div>
    </div>
  );
}
