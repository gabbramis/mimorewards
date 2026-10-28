import { notFound, redirect } from 'next/navigation';
import { isSuperadmin } from '@/lib/authz';
import { createAdminClient } from '@/lib/supabase/admin';
import EditBusinessForm from './edit-business-form';

export default async function EditBusinessPage({ params }: { params: Promise<{ businessId: string }> }) {
  if (!await isSuperadmin()) redirect('/admin');
  const { businessId } = await params;
  const { data: business, error } = await createAdminClient().from('businesses')
    .select('id, name, logo_url, active, reward_target, reward_description, primary_color, card_text_color, card_accent_color, stamp_source, stamp_catalog_id, stamp_completed_url, stamp_pending_url, stamp_pending_effect, wallet_config, plan_type')
    .eq('id', businessId).maybeSingle();
  if (error || !business) notFound();
  return <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8"><EditBusinessForm business={business} /></main>;
}
