import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import type { WalletLocation } from './locations';

type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
export type LocationJobStatus = 'pending' | 'processing' | 'accepted' | 'failed' | 'skipped';
export type LocationSyncJob = {
  id: string; business_id: string; revision: number; channel: 'apple' | 'google'; target_key: string;
  push_token: string | null; pass_type_identifier: string | null; status: LocationJobStatus;
  attempts: number; available_at: string; lease_token: string | null; locked_until: string | null;
  error_code: string | null; created_at: string; processed_at: string | null;
};
export type LocationSyncSummary = {
  counts: Partial<Record<LocationJobStatus, number>>;
  errors: { channel: 'apple' | 'google'; error_code: string; attempts: number; status: LocationJobStatus }[];
};
type Business = {
  id: string; name: string; slug: string; active: boolean; logo_url: string | null;
  primary_color: string | null; wallet_config: Record<string, unknown> | null;
  wallet_locations_enabled: boolean; wallet_location_revision: number;
};
// Boundary for migration 020. Replace with generated whole-project types once available.
type LocationDatabase = {
  public: {
    Tables: {
      businesses: Table<Business>;
      business_members: Table<{ business_id: string; user_id: string; role: 'merchant' | 'staff' }>;
      branch_wallet_locations: Table<Omit<WalletLocation, 'appleRelevantText'> & { business_id: string; apple_relevant_text: string }>;
      wallet_location_sync_jobs: Table<LocationSyncJob>;
    };
    Views: Record<string, never>;
    Functions: {
      save_wallet_locations: { Args: { p_business_id: string; p_enabled: boolean; p_expected_revision: number; p_locations: WalletLocation[] }; Returns: number };
      claim_wallet_location_jobs: { Args: { p_business_id: string | null }; Returns: LocationSyncJob[] };
      wallet_location_sync_summary: { Args: { p_business_id: string; p_revision: number }; Returns: LocationSyncSummary };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export function walletLocationClient() {
  return createAdminClient() as unknown as SupabaseClient<LocationDatabase>;
}
