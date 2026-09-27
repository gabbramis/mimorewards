import { ContactsCRM } from "@/app/admin/contactos/page";

export default async function MerchantCustomersPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return <ContactsCRM businessId={businessId} merchantMode />;
}
