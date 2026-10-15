import CustomerExperience from "@/components/customer/CustomerExperience";

export default async function NfcEntryPage({ params, searchParams }: {
  params: Promise<{ nfcId: string }>;
  searchParams: Promise<{ stamp?: string }>;
}) {
  const [{ nfcId }, query] = await Promise.all([params, searchParams]);
  return <CustomerExperience nfcId={nfcId} stampStatus={query.stamp || null} />;
}
