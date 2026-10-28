import 'server-only';
import { walletLocationClient } from './location-database';
import { patchGoogleWalletLoyaltyClass } from './googleWallet';
import { PASS_TYPE_ID } from './appleWallet';
import { sendApnsNotification } from './apns';

/** Bounded durable queue: PATCH and empty APNs pushes are safe to repeat after a crash. */
export async function processWalletLocationJobs(businessId?: string) {
  const supabase = walletLocationClient();
  const { data: jobs, error } = await supabase.rpc('claim_wallet_location_jobs', { p_business_id: businessId ?? null });
  if (error) throw new Error('No se pudo iniciar el lote de sincronización.');
  const results = await Promise.all((jobs ?? []).map(async (job) => {
    let accepted = false;
    let skipped = false;
    let errorCode: string | null = null;
    try {
      const { data: business, error: readError } = await supabase.from('businesses')
        .select('id, name, logo_url, primary_color, wallet_config, active, wallet_location_revision')
        .eq('id', job.business_id).maybeSingle();
      if (readError || !business) throw new Error('business_unavailable');
      if (business.wallet_location_revision !== job.revision) {
        skipped = true;
        errorCode = 'superseded';
      } else if (!business.active) {
        skipped = true;
        errorCode = 'business_inactive';
      } else if (job.channel === 'google') {
        const result = await patchGoogleWalletLoyaltyClass(business.id, {
          businessName: business.name, hexBackgroundColor: business.primary_color,
          logoUrl: business.logo_url, walletConfig: business.wallet_config,
        });
        accepted = result.success;
        if (!accepted) errorCode = 'google_update_failed';
      } else if (job.pass_type_identifier !== PASS_TYPE_ID) {
        skipped = true;
        errorCode = 'pass_type_mismatch';
      } else {
        const result = await sendApnsNotification(job.push_token, job.pass_type_identifier);
        accepted = result.success;
        skipped = result.unregistered === true;
        if (!accepted) errorCode = `apns_${result.status}`;
      }
    } catch {
      errorCode = 'provider_unavailable';
    }
    const status = accepted ? 'accepted' : skipped ? 'skipped' : job.attempts >= 3 ? 'failed' : 'pending';
    const { error: updateError } = await supabase.from('wallet_location_sync_jobs').update({
      status, error_code: errorCode, locked_until: null,
      available_at: new Date(Date.now() + 60_000 * 2 ** job.attempts).toISOString(),
      processed_at: status === 'pending' ? null : new Date().toISOString(),
    }).eq('id', job.id).eq('lease_token', job.lease_token).eq('status', 'processing');
    if (updateError) throw new Error('No se pudo registrar el resultado del lote.');
    return { status };
  }));
  return { processed: results.length, accepted: results.filter((result) => result.status === 'accepted').length };
}
