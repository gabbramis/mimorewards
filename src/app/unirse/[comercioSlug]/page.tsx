import { notFound } from "next/navigation";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import OnboardingForm from "./OnboardingForm";

type PageProps = { params: Promise<{ comercioSlug: string }> };

export default async function UnirsePage({ params }: PageProps) {
  const { comercioSlug } = await params;
  const decodedSlug = decodeURIComponent(comercioSlug);

  const supabase: any = createAdminClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, slug, name, logo_url, reward_description, active")
    .eq("slug", decodedSlug)
    .single();

  if (!business || !business.active) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#FFFBF8] font-sans pb-10">
      <div className="max-w-md mx-auto min-h-screen flex flex-col pt-8">
        <div className="flex-1 px-6 pt-4 flex flex-col">
          <div className="flex flex-col items-center mb-8">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.name} className="h-16 tracking-tight w-auto object-contain mb-4 drop-shadow-sm" onError={(e) => { e.currentTarget.src = "/images/mimo-wordmark.png"; }} />
            ) : (
              <Image src="/images/mimo-wordmark.png" width={180} height={70} alt="mimo rewards" className="mb-4 drop-shadow-sm" />
            )}
            <h1 className="text-3xl font-bold text-center text-[#1F1F1F] tracking-tight">{business.name}</h1>
          </div>

          <OnboardingForm slug={business.slug} businessName={business.name} rewardDescription={business.reward_description} />
        </div>

        <footer className="w-full pb-6 pt-10 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[13px] text-gray-400 font-medium tracking-wide">
            <span>Powered by</span>
            <Image src="/images/mimo-wordmark.png" width={56} height={22} alt="mimo rewards" className="opacity-70 grayscale" />
          </div>
        </footer>
      </div>
    </div>
  );
}
