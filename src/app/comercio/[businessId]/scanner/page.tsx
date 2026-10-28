import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ businessId: string }>;
}

export default async function MerchantScannerRedirectPage({ params }: PageProps) {
  const { businessId } = await params;
  redirect(`/comercio/${businessId}/escaner`);
}
