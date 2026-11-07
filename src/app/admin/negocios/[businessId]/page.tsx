import { notFound, redirect } from 'next/navigation';
import { isSuperadmin } from '@/lib/authz';
import { createAdminClient } from '@/lib/supabase/admin';
import EditBusinessForm from './edit-business-form';

export default async function EditBusinessPage({ params }: { params: Promise<{ businessId: string }> }) {
  if (!await isSuperadmin()) redirect('/admin');
  const { businessId } = await params;
  const { data: business, error } = await createAdminClient().from('businesses')
    .select('*')
    .eq('id', businessId).maybeSingle();
  if (error || !business) notFound();
  return <div className="w-full max-w-7xl mx-auto"><EditBusinessForm business={business} /></div>;
}
